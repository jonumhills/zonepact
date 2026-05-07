"""
Parcels GeoJSON endpoint — fetches petition polygon overlays from Supabase.
Falls back to point features from local JSON if Supabase is unavailable.
"""
import os
import json
import sys
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        _sb = None
else:
    _sb = None

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')


def _fallback_geojson(county_id: str) -> dict:
    if county_id == 'raleigh_nc':
        path = os.path.join(DATA_DIR, 'raleigh_petitions.json')
    else:
        path = os.path.join(DATA_DIR, 'petitions.json')
    try:
        with open(path) as f:
            d = json.load(f)
        petitions = d.get('petitions', d) if isinstance(d, dict) else d
        features = []
        for p in petitions:
            if p.get('latitude') and p.get('longitude'):
                features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [p['longitude'], p['latitude']]},
                    'properties': {k: v for k, v in p.items() if k not in ('latitude', 'longitude')},
                })
        return {'type': 'FeatureCollection', 'features': features}
    except FileNotFoundError:
        return {'type': 'FeatureCollection', 'features': []}


def _build_features(parcels_data: list, pet_by_num: dict, pet_by_id: dict) -> list:
    features = []
    for parcel in parcels_data:
        # Prefer arcgis_geometry (enriched), fall back to geometry
        geometry = parcel.get('arcgis_geometry') or parcel.get('geometry')
        if not geometry:
            continue

        petition = (
            pet_by_num.get(parcel.get('petition_number'))
            or pet_by_id.get(parcel.get('petition_id'))
            or {}
        )
        meeting_date = petition.get('meeting_date', '')
        if meeting_date and hasattr(meeting_date, 'isoformat'):
            meeting_date = meeting_date.isoformat()

        features.append({
            'type': 'Feature',
            'geometry': geometry,
            'properties': {
                'petition_number': petition.get('petition_number') or parcel.get('petition_number', ''),
                'pin':             parcel.get('arcgis_pin') or parcel.get('pin', ''),
                'site_address':    parcel.get('site_address') or petition.get('location') or petition.get('address', ''),
                'owner':           parcel.get('owner', ''),
                'type_and_use':    parcel.get('type_and_use', ''),
                'area_sqft':       parcel.get('calc_area', ''),
                'total_value':     parcel.get('total_value_assd', ''),
                'current_zoning':  petition.get('current_zoning', ''),
                'proposed_zoning': petition.get('proposed_zoning', ''),
                'petitioner':      petition.get('petitioner', ''),
                'status':          petition.get('status', ''),
                'vote_result':     petition.get('vote_result', ''),
                'meeting_date':    meeting_date,
            },
        })
    return features


@router.get('/parcels/geojson')
async def get_parcels_geojson(
    county_id: str = Query('raleigh_nc'),
    petition_number: Optional[str] = Query(None),
):
    """
    Return GeoJSON FeatureCollection of petition parcels (polygon geometry).
    Optionally filter to a single petition with ?petition_number=Z-51-2024.
    """
    if _sb:
        try:
            parcels_q = (
                _sb.table('parcels')
                .select('parcel_id, petition_id, petition_number, pin, arcgis_pin, '
                        'geometry, arcgis_geometry, site_address, owner, type_and_use, '
                        'calc_area, total_value_assd')
                .eq('county_id', county_id)
                .not_.is_('petition_number', 'null')
            )
            if petition_number:
                parcels_q = parcels_q.eq('petition_number', petition_number)

            parcels_res = parcels_q.execute()

            pet_res = (
                _sb.table('petitions')
                .select(
                    'petition_id, petition_number, location, address, '
                    'current_zoning, proposed_zoning, petitioner, status, vote_result, meeting_date'
                )
                .eq('county_id', county_id)
                .execute()
            )
            pet_by_num = {p['petition_number']: p for p in (pet_res.data or []) if p.get('petition_number')}
            pet_by_id  = {p['petition_id']:     p for p in (pet_res.data or []) if p.get('petition_id')}

            features = _build_features(parcels_res.data or [], pet_by_num, pet_by_id)
            return JSONResponse({'type': 'FeatureCollection', 'features': features})
        except Exception as e:
            pass  # fall through to fallback

    return JSONResponse(_fallback_geojson(county_id))


# ── SNS: parcel watch subscription ───────────────────────────────────────────

class WatchRequest(BaseModel):
    email: str
    pin: str
    address: str


@router.post('/watch')
async def subscribe_parcel_watch_endpoint(req: WatchRequest):
    """Subscribe an email to SNS alerts for a parcel PIN via AWS SNS."""
    try:
        from aws_services import subscribe_parcel_watch
        return subscribe_parcel_watch(req.email, req.pin, req.address)
    except ImportError:
        return {"ok": False, "error": "AWS services not available (boto3 not installed)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
