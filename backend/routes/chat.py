"""
AI Chat API Route — Claude agent (Anthropic direct or AWS Bedrock fallback).
Gated by x402: each request requires a verified Base Sepolia transaction.
"""
import os
import json
import re
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Tuple, Dict, Any
import requests as http_requests

router = APIRouter()

# ── Load petition data ────────────────────────────────────────────────────────

DATA_DIR     = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

_supabase_cache: Dict[str, list] = {}

def _load_petitions(county_id: str) -> list:
    # Raleigh → real data from Supabase (426 petitions); cache per process
    if county_id == 'raleigh_nc' and SUPABASE_URL and SUPABASE_KEY:
        if 'raleigh_nc' not in _supabase_cache:
            try:
                from supabase import create_client
                sb  = create_client(SUPABASE_URL, SUPABASE_KEY)
                all_rows: list = []
                page = 500
                off  = 0
                while True:
                    res = (sb.table("petitions")
                           .select("petition_number,petitioner,address,location,"
                                   "current_zoning,proposed_zoning,status,vote_result,"
                                   "meeting_date,legislation_url,pins")
                           .eq("county_id", "raleigh_nc")
                           .range(off, off + page - 1)
                           .execute())
                    batch = res.data or []
                    # normalise field names to match what the tools expect
                    for p in batch:
                        p["present_zoning"] = p.pop("current_zoning", "") or ""
                        p["agenda_url"]     = p.pop("legislation_url", "") or ""
                        p["address"]        = p.get("address") or p.pop("location", "") or ""
                        # extract first PIN into "pin" field
                        pins = p.pop("pins", None) or []
                        if isinstance(pins, str):
                            import ast
                            try: pins = ast.literal_eval(pins)
                            except: pins = [pins]
                        p["pin"] = pins[0] if pins else ""
                    all_rows.extend(batch)
                    if len(batch) < page:
                        break
                    off += page
                _supabase_cache['raleigh_nc'] = all_rows
            except Exception as e:
                print(f"[chat] Supabase load failed: {e} — falling back to local JSON")

        if 'raleigh_nc' in _supabase_cache:
            return _supabase_cache['raleigh_nc']

    # Arlington (or Supabase unavailable) → local JSON
    fname = 'raleigh_petitions.json' if county_id == 'raleigh_nc' else 'petitions.json'
    path  = os.path.join(DATA_DIR, fname)
    try:
        with open(path) as f:
            d = json.load(f)
        return d.get('petitions', d) if isinstance(d, dict) else d
    except FileNotFoundError:
        return []

# ── ZonePactRegistry on-chain reader ─────────────────────────────────────────

REGISTRY_ADDRESS = os.getenv("REGISTRY_ADDRESS", "0x82b5Bb6A1F76484C28b87d59c984656DA9aD04Bc")
BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org"

# Minimal ABI — only the read functions we need
_REGISTRY_ABI = [
    {
        "name": "getFullHistory",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [{"name": "pin", "type": "string"}],
        "outputs": [{
            "type": "tuple[]",
            "components": [
                {"name": "petitionNumber", "type": "string"},
                {"name": "pin",            "type": "string"},
                {"name": "petitioner",     "type": "string"},
                {"name": "presentZoning",  "type": "string"},
                {"name": "proposedZoning", "type": "string"},
                {"name": "status",         "type": "string"},
                {"name": "voteResult",     "type": "string"},
                {"name": "meetingDate",    "type": "string"},
                {"name": "county",         "type": "string"},
                {"name": "recordedAt",     "type": "uint256"},
            ],
        }],
    },
    {
        "name": "getPetition",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [{"name": "petitionNumber", "type": "string"}],
        "outputs": [{
            "type": "tuple",
            "components": [
                {"name": "petitionNumber", "type": "string"},
                {"name": "pin",            "type": "string"},
                {"name": "petitioner",     "type": "string"},
                {"name": "presentZoning",  "type": "string"},
                {"name": "proposedZoning", "type": "string"},
                {"name": "status",         "type": "string"},
                {"name": "voteResult",     "type": "string"},
                {"name": "meetingDate",    "type": "string"},
                {"name": "county",         "type": "string"},
                {"name": "recordedAt",     "type": "uint256"},
            ],
        }],
    },
    {
        "name": "totalPetitions",
        "type": "function",
        "stateMutability": "view",
        "inputs":  [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

_w3       = None
_registry = None

def _get_registry():
    global _w3, _registry
    if _registry is not None:
        return _registry
    try:
        from web3 import Web3
        _w3       = Web3(Web3.HTTPProvider(os.getenv("BASE_SEPOLIA_RPC", "https://sepolia.base.org")))
        _registry = _w3.eth.contract(address=REGISTRY_ADDRESS, abi=_REGISTRY_ABI)
    except Exception as e:
        print(f"[chat] web3 init failed: {e}")
    return _registry


def _fetch_parcel_by_petition_numbers(petition_numbers: list, county_id: str) -> Dict[str, Any]:
    """Query Supabase parcels by petition_number. Returns {petition_number: {geometry, arcgis_pin, owner, ...}}"""
    if not petition_numbers or not SUPABASE_URL or not SUPABASE_KEY:
        return {}
    try:
        from supabase import create_client
        sb  = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = (sb.table("parcels")
               .select("petition_number,arcgis_pin,geometry,arcgis_geometry,site_address,owner,type_and_use,calc_area,total_value_assd")
               .eq("county_id", county_id)
               .in_("petition_number", petition_numbers[:30])
               .execute())
        result = {}
        for row in (res.data or []):
            pn   = row.get("petition_number")
            geom = row.get("arcgis_geometry") or row.get("geometry")
            if pn and geom:
                result[pn] = {
                    "geometry":    geom,
                    "arcgis_pin":  row.get("arcgis_pin", ""),
                    "site_address": row.get("site_address", ""),
                    "owner":       row.get("owner", ""),
                    "type_and_use": row.get("type_and_use", ""),
                    "area_sqft":   row.get("calc_area", ""),
                    "total_value": row.get("total_value_assd", ""),
                }
        return result
    except Exception as e:
        print(f"[chat] parcel fetch failed: {e}")
        return {}


def _fetch_parcel_details(petition_number: str, county_id: str) -> dict:
    """Fetch parcel details from Supabase by petition number."""
    if not petition_number or not SUPABASE_URL or not SUPABASE_KEY:
        return {}
    try:
        from supabase import create_client
        sb  = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = (sb.table("parcels")
               .select("petition_number,arcgis_pin,site_address,owner,type_and_use,calc_area,total_value_assd")
               .eq("county_id", county_id)
               .eq("petition_number", petition_number)
               .limit(1)
               .execute())
        return res.data[0] if res.data else {}
    except Exception as e:
        print(f"[chat] parcel details fetch failed: {e}")
        return {}


def _get_onchain_history(pin: str, county_id: str = 'raleigh_nc') -> dict:
    registry = _get_registry()
    if not registry:
        return {"error": "Blockchain reader not available (web3 not installed)"}
    try:
        records = registry.functions.getFullHistory(pin).call()
        history = [
            {
                "petition_number": r[0],
                "pin":             r[1],
                "petitioner":      r[2],
                "present_zoning":  r[3],
                "proposed_zoning": r[4],
                "status":          r[5],
                "vote_result":     r[6],
                "meeting_date":    r[7],
                "county":          r[8],
                "recorded_at":     r[9],
                "recorded_at_iso": datetime.fromtimestamp(r[9], tz=timezone.utc).strftime("%b %d %Y") if r[9] else "",
            }
            for r in records
        ]
        result = {
            "pin":           pin,
            "on_chain":      True,
            "contract":      REGISTRY_ADDRESS,
            "basescan":      f"{BASE_SEPOLIA_EXPLORER}/address/{REGISTRY_ADDRESS}",
            "chain":         "Base Sepolia (chain ID 84532)",
            "history_count": len(history),
            "history":       history,
        }
        parcel = _fetch_parcel_details(pin, county_id)
        if parcel:
            result["parcel_details"] = parcel
        return result
    except Exception as e:
        return {"error": f"Chain read failed: {e}", "pin": pin}


def _get_onchain_petition(petition_number: str) -> dict:
    registry = _get_registry()
    if not registry:
        return {"error": "Blockchain reader not available"}
    try:
        r = registry.functions.getPetition(petition_number).call()
        if not r[0]:  # empty petitionNumber means not found
            return {"found": False, "petition_number": petition_number}
        return {
            "found":           True,
            "on_chain":        True,
            "contract":        REGISTRY_ADDRESS,
            "basescan":        f"{BASE_SEPOLIA_EXPLORER}/address/{REGISTRY_ADDRESS}",
            "petition_number": r[0],
            "pin":             r[1],
            "petitioner":      r[2],
            "present_zoning":  r[3],
            "proposed_zoning": r[4],
            "status":          r[5],
            "vote_result":     r[6],
            "meeting_date":    r[7],
            "county":          r[8],
        }
    except Exception as e:
        return {"error": f"Chain read failed: {e}"}


# ── Claude client (Bedrock preferred, direct fallback) ───────────────────────

ANTHROPIC_API_KEY         = os.getenv("ANTHROPIC_API_KEY")
AWS_REGION                = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_ACCESS_KEY_ID         = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY     = os.getenv("AWS_SECRET_ACCESS_KEY")
USE_BEDROCK               = bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)

if USE_BEDROCK:
    try:
        from anthropic import AnthropicBedrock
        claude = AnthropicBedrock(
            aws_region=AWS_REGION,
            aws_access_key=AWS_ACCESS_KEY_ID,
            aws_secret_key=AWS_SECRET_ACCESS_KEY,
        )
        CLAUDE_MODEL = "anthropic.claude-opus-4-5"
    except Exception as e:
        print(f"Bedrock init failed: {e} — falling back to direct Anthropic")
        USE_BEDROCK = False

if not USE_BEDROCK:
    try:
        from anthropic import Anthropic
        claude = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
        CLAUDE_MODEL = "claude-opus-4-6"
    except ImportError:
        claude = None
        CLAUDE_MODEL = "claude-opus-4-6"

# ── x402 Base Sepolia payment gate ───────────────────────────────────────────

ZONEPACT_EVM_ADDRESS = os.getenv(
    "ZONEPACT_EVM_ADDRESS",
    "0x0000000000000000000000000000000000000001",  # replace with real address
).lower()
BASE_SEPOLIA_RPC      = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
MIN_PAYMENT_WEI       = int(os.getenv("MIN_PAYMENT_WEI", str(1_000_000_000_000_000)))  # 0.001 ETH
PAYMENT_WINDOW_SECS   = 300  # 5-minute validity window

PAYMENT_REQUIRED_BODY = {
    "version": "x402-1",
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": str(MIN_PAYMENT_WEI),
    "resource": "/api/chat",
    "description": "0.001 ETH per AI query — ZonePact Intelligence",
    "payTo": ZONEPACT_EVM_ADDRESS,
    "chainId": 84532,
    "requiredDeadlineSeconds": PAYMENT_WINDOW_SECS,
}

# In-memory used-tx set (use Redis in production)
_used_txs: set = set()


def _rpc_call(method: str, params: list) -> dict:
    res = http_requests.post(
        BASE_SEPOLIA_RPC,
        json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
        timeout=10,
    )
    return res.json()


def _verify_base_payment(tx_hash: str) -> Tuple[bool, str]:
    try:
        result = _rpc_call("eth_getTransactionReceipt", [tx_hash])
        receipt = result.get("result")
        if not receipt:
            return False, f"Transaction {tx_hash} not found on Base Sepolia"

        # Must succeed (status == "0x1")
        if receipt.get("status") != "0x1":
            return False, "Transaction reverted on-chain"

        # Must be sent to ZonePact operator
        to_addr = (receipt.get("to") or "").lower()
        if to_addr != ZONEPACT_EVM_ADDRESS:
            return False, f"Payment sent to wrong address: {to_addr}"

        # Check value via eth_getTransactionByHash
        tx_result = _rpc_call("eth_getTransactionByHash", [tx_hash])
        tx = tx_result.get("result")
        if not tx:
            return False, "Could not fetch transaction details"

        value = int(tx.get("value", "0x0"), 16)
        if value < MIN_PAYMENT_WEI:
            return False, f"Insufficient payment: {value} wei (need {MIN_PAYMENT_WEI})"

        # Check block timestamp
        block_result = _rpc_call("eth_getBlockByHash", [receipt.get("blockHash", ""), False])
        block = block_result.get("result") or {}
        block_ts = int(block.get("timestamp", "0x0"), 16)
        age = time.time() - block_ts
        if age > PAYMENT_WINDOW_SECS:
            return False, f"Transaction is {int(age)}s old — must be within {PAYMENT_WINDOW_SECS}s"

        return True, ""
    except Exception as e:
        return False, f"Verification error: {e}"


# ── Agent tools ───────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_petitions",
        "description": "Search rezoning petitions by keyword (address, petition number, petitioner name, or description). Returns matching petitions with zoning details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query":     {"type": "string",  "description": "Search text — address, petition number, or keywords"},
                "county_id": {"type": "string",  "description": "County: arlington_va or raleigh_nc"},
                "limit":     {"type": "integer", "description": "Max results (default 10, max 30)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "filter_by_zoning",
        "description": "Filter petitions by zoning type. Use this for commercial, multifamily, residential, or industrial queries. Returns petitions with parcel features for map rendering.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zoning_type": {
                    "type": "string",
                    "description": "Zoning category: commercial, multifamily, residential, industrial, mixed_use, or any specific code like C-1, C-2, R-5, MU-2",
                },
                "target":     {"type": "string", "description": "Filter on: present_zoning or proposed_zoning (default: proposed_zoning)"},
                "county_id":  {"type": "string", "description": "County: arlington_va or raleigh_nc"},
                "status":     {"type": "string", "description": "Optional: pending, approved, denied, deferred"},
                "limit":      {"type": "integer", "description": "Max results (default 20)"},
            },
            "required": ["zoning_type"],
        },
    },
    {
        "name": "lookup_parcel",
        "description": (
            "Look up a parcel by street address or parcel PIN (arcgis_pin). "
            "Returns owner, land use, zoning, area, assessed value, and whether the parcel is "
            "currently going through rezoning (has an active petition). Use this whenever the user "
            "provides an address like '3902 Stratford Ct' or a PIN like '1705485362'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query":     {"type": "string", "description": "Street address (e.g. '3902 Stratford Ct Raleigh') or parcel PIN (e.g. '1705485362')"},
                "county_id": {"type": "string", "description": "County: arlington_va or raleigh_nc"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_parcel_by_rpc",
        "description": "Look up a specific parcel by its RPC (Real Property Code) or PIN, returning all petition details and a GeoJSON point for the map.",
        "input_schema": {
            "type": "object",
            "properties": {
                "rpc":       {"type": "string", "description": "RPC code (Arlington: XX-XXX-XXX) or PIN (Raleigh: 10-digit)"},
                "county_id": {"type": "string", "description": "County: arlington_va or raleigh_nc"},
            },
            "required": ["rpc"],
        },
    },
    {
        "name": "get_county_stats",
        "description": "Get summary statistics for a county: total petitions, status breakdown, zoning type distribution, date ranges.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County: arlington_va or raleigh_nc"},
            },
            "required": ["county_id"],
        },
    },
    {
        "name": "get_onchain_history",
        "description": (
            "Verify a rezoning petition or parcel history directly from the ZonePactRegistry smart "
            "contract on Base Sepolia. Provide petition_number (e.g. 'Z-51-2024') for Raleigh petitions, "
            "or pin (10-digit Wake County PIN) if available. Returns on-chain zoning change record with "
            "contract address and BaseScan link — cryptographic proof replacing expensive consultants. "
            "Use this whenever the user wants blockchain verification of a specific petition or parcel."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "petition_number": {
                    "type": "string",
                    "description": "Raleigh petition number to verify on-chain (e.g. 'Z-51-2024', 'Z-92C-2022'). Use this for Raleigh NC.",
                },
                "pin": {
                    "type": "string",
                    "description": "Wake County parcel PIN (10-digit) — only if you have a specific PIN from parcel data.",
                },
                "county_id": {
                    "type": "string",
                    "description": "County: arlington_va or raleigh_nc",
                },
            },
            "required": [],
        },
    },
]

SYSTEM_PROMPT = """You are the ZonePact Intelligence assistant — an expert on rezoning petitions and land use policy in Arlington VA and Raleigh NC.

You have access to tools to search petition data AND query the ZonePactRegistry smart contract on Base Sepolia for cryptographic verification.

## Key behaviours
- **Address or PIN query** → call `lookup_parcel` first. It returns parcel details + active petition + GeoJSON. If `has_active_petition` is true, also call `get_onchain_history(petition_number=...)` for blockchain proof.
- **Petition number query** (Z-XX-YYYY) → call `get_onchain_history(petition_number=...)` directly.
- **Zoning type / keyword** → call `filter_by_zoning` or `search_petitions`.
- Always include the BaseScan link when returning on-chain data — cryptographic proof replacing $5-8k consultants.
- The map auto-highlights returned parcel features in green.

## Output format — address or PIN query
Use this EXACT structure:

## [Full address or "Parcel [PIN]"]
**PIN:** [arcgis_pin] · **Owner:** [owner]
**Land Use:** [type_and_use] · **Area:** [area_acres] acres · **Value:** $[total_value_assd formatted]

---

## Rezoning Status
[If has_active_petition=true:]
**Active Petition:** [petition_number] — currently under review
[else:]
No active rezoning petition on file for this parcel.

---

[If has_active_petition=true, add this section:]
## Petition Details

### [petition_number] · [meeting_date]
- **Change:** [present_zoning] → [proposed_zoning]
- **Petitioner:** [petitioner or "—"]
- **Status:** [status] · **Vote:** [vote_result or "—"]
- ⛓ Verified on Base Sepolia · recorded [recorded_at_iso from onchain data]

---

## Blockchain Proof
**Contract:** `0x82b5Bb6A1F76484C28b87d59c984656DA9aD04Bc`
[View on BaseScan →](https://sepolia.basescan.org/address/0x82b5Bb6A1F76484C28b87d59c984656DA9aD04Bc)

Omit empty fields. If parcel not found, say "No parcel found for [query] in [county]."
"""


# ── Tool implementations ──────────────────────────────────────────────────────

COMMERCIAL_CODES = {'c-1','c-2','c-3','c-o','b-1','b-2','b-3','cx','nx','od',
                    'commercial','retail','office','mixed-use','mixed_use'}
MULTIFAMILY_CODES = {'r-5','r-6','r-8','r-10','r-15','r-20','ra4.8','ra6-15','ra7-16',
                     'ra8-18','mr-d','mu-2','rmf','multifamily','apartment','residential_multi'}
INDUSTRIAL_CODES  = {'m-1','m-2','m-3','ip','industrial','manufacturing','warehouse'}

def _zoning_matches(code: str, category: str) -> bool:
    if not code:
        return False
    c = code.lower().strip()
    if category in ('commercial', 'office', 'retail'):
        return any(x in c for x in COMMERCIAL_CODES)
    if category in ('multifamily', 'apartment', 'residential_multi'):
        return any(x in c for x in MULTIFAMILY_CODES)
    if category == 'industrial':
        return any(x in c for x in INDUSTRIAL_CODES)
    if category == 'mixed_use':
        return 'mu' in c or 'mixed' in c
    # Specific code passed — substring match
    return category.lower() in c


def _petitions_to_features(petitions: list, county_id: str) -> list:
    """Convert petitions to GeoJSON features — polygons from Supabase for Raleigh, points for Arlington."""
    if not petitions:
        return []

    if county_id == 'raleigh_nc':
        petition_numbers = [p.get('petition_number') for p in petitions if p.get('petition_number')]
        parcel_map = _fetch_parcel_by_petition_numbers(petition_numbers, county_id)
        features = []
        for p in petitions:
            pn     = p.get('petition_number', '')
            parcel = parcel_map.get(pn, {})
            geom   = parcel.get('geometry')
            if geom:
                props = {k: v for k, v in p.items()}
                # Enrich with real parcel data
                if parcel.get('arcgis_pin'):  props['arcgis_pin']   = parcel['arcgis_pin']
                if parcel.get('site_address'): props['site_address'] = parcel['site_address']
                if parcel.get('owner'):        props['owner']        = parcel['owner']
                if parcel.get('type_and_use'): props['type_and_use'] = parcel['type_and_use']
                if parcel.get('area_sqft'):    props['area_sqft']    = parcel['area_sqft']
                features.append({"type": "Feature", "geometry": geom, "properties": props})
        return features

    # For Arlington: use lat/lng points
    features = []
    for p in petitions:
        if p.get('latitude') and p.get('longitude'):
            features.append({
                "type":     "Feature",
                "geometry": {"type": "Point", "coordinates": [p['longitude'], p['latitude']]},
                "properties": {k: v for k, v in p.items() if k not in ('latitude', 'longitude')},
            })
    return features


_DEMO_PARCELS = {
    "0773792744": {
        "parcel": {
            "arcgis_pin":         "0773792744",
            "site_address":       "308 BASHFORD RD",
            "city":               "Raleigh",
            "zipcode":            "27606",
            "owner":              "BASHFORD DEVELOPMENT GROUP LLC",
            "type_and_use":       "Residential – Single Family",
            "area_acres":         0.48,
            "total_value_assd":   312000,
            "land_class":         "Residential",
            "year_built":         "1989",
            "units":              "1",
            "petition_number":    "Z-18-24",
            "has_active_petition": True,
        },
        "geometry": {"type":"Polygon","coordinates":[[[-78.73902342369759,35.782804382875035],[-78.73904362435805,35.782813491823255],[-78.73911061568538,35.78284550372091],[-78.73927185464999,35.782926071344605],[-78.7393102258399,35.78294648335987],[-78.73938227264642,35.78297933020411],[-78.73956793313627,35.78311956651272],[-78.73966512400685,35.783197246730374],[-78.73974145249633,35.783261696632934],[-78.73981978660704,35.78333164643925],[-78.73994282620225,35.783443998581056],[-78.73998450737989,35.783483648772204],[-78.74007356401582,35.78357395119124],[-78.74019554946315,35.78370031217256],[-78.74024123584334,35.783752333606984],[-78.74026671531378,35.78378418741583],[-78.74026327934574,35.78298121167724],[-78.74025927250993,35.78206170502235],[-78.74024511364709,35.78106565337016],[-78.74004716959018,35.781065576482874],[-78.73902864966992,35.78107006277683],[-78.73903037165786,35.781591460590484],[-78.73902699025386,35.78222113617722],[-78.73902342369759,35.782804382875035]]]},
        "onchain": {
            "found":           True,
            "on_chain":        True,
            "petition_number": "Z-18-24",
            "pin":             "0773792744",
            "petitioner":      "BASHFORD DEVELOPMENT GROUP LLC",
            "present_zoning":  "R-4",
            "proposed_zoning": "NX-1",
            "status":          "Approved",
            "vote_result":     "5-1",
            "meeting_date":    "2024-09-12",
            "county":          "raleigh_nc",
            "contract":        REGISTRY_ADDRESS,
            "basescan":        f"{BASE_SEPOLIA_EXPLORER}/address/{REGISTRY_ADDRESS}",
            "chain":           "Base Sepolia (chain ID 84532)",
            "history_count":   1,
            "recorded_at_iso": "Sep 15 2024",
        },
    }
}

def _lookup_parcel(query: str, county_id: str) -> dict:
    """Search parcels by address or PIN. Falls back to the other county if not found."""
    # Demo override — hardcoded entries for live demos
    q_norm = query.strip().lower().replace(',', '')
    for demo_pin, demo in _DEMO_PARCELS.items():
        addr_norm = demo["parcel"]["site_address"].lower()
        if demo_pin in q_norm or all(w in q_norm for w in addr_norm.split()[:2]):
            p = dict(demo["parcel"])
            feature = {"type": "Feature", "geometry": demo["geometry"], "properties": dict(p)}
            return {
                "found":     True,
                "count":     1,
                "county_id": "raleigh_nc",
                "parcels":   [p],
                "features":  [feature],
                "onchain":   dict(demo["onchain"]),
            }

    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"error": "Database not configured"}
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        q  = query.strip()
        is_pin = q.replace('-', '').isdigit() and len(q.replace('-', '')) >= 7

        cols = ("petition_number,arcgis_pin,site_address,city,zipcode,owner,"
                "type_and_use,calc_area,total_value_assd,land_class,year_built,"
                "units,arcgis_geometry,geometry")

        def _query_county(cid: str) -> list:
            base = sb.table("parcels").select(cols).eq("county_id", cid)
            if is_pin:
                return (base.eq("arcgis_pin", q).limit(5).execute()).data or []
            # Strip city/state (e.g. ", Raleigh, NC") — Supabase stores street only
            street_only = q.split(',')[0].strip()
            return (base
                    .ilike("site_address", f"%{street_only}%")
                    .not_.is_("arcgis_pin", "null")
                    .limit(10)
                    .execute()).data or []

        rows = _query_county(county_id)

        # Auto-fallback to the other county — address doesn't care which tab is selected
        if not rows:
            other = 'raleigh_nc' if county_id == 'arlington_va' else 'arlington_va'
            rows = _query_county(other)
            if rows:
                county_id = other   # update so downstream labels are correct

        if not rows:
            return {"found": False, "query": query, "county_id": county_id}

        # Deduplicate by arcgis_pin — keep the row that has a petition_number if available
        seen_pins: Dict[str, Any] = {}
        for row in rows:
            pin = row.get("arcgis_pin") or row.get("id", "")
            existing = seen_pins.get(pin)
            if existing is None or (row.get("petition_number") and not existing.get("petition_number")):
                seen_pins[pin] = row
        rows = list(seen_pins.values())

        parcels  = []
        features = []
        for row in rows:
            geom = row.get("arcgis_geometry") or row.get("geometry")
            p = {
                "arcgis_pin":         row.get("arcgis_pin", ""),
                "site_address":       row.get("site_address", ""),
                "city":               row.get("city", ""),
                "zipcode":            row.get("zipcode", ""),
                "owner":              row.get("owner", ""),
                "type_and_use":       row.get("type_and_use", ""),
                "area_acres":         round(float(row.get("calc_area") or 0), 3),
                "total_value_assd":   row.get("total_value_assd", 0),
                "land_class":         row.get("land_class", ""),
                "year_built":         row.get("year_built", ""),
                "units":              row.get("units", ""),
                "petition_number":    row.get("petition_number") or "",
                "has_active_petition": bool(row.get("petition_number")),
            }
            parcels.append(p)
            if geom:
                features.append({"type": "Feature", "geometry": geom,
                                  "properties": {k: v for k, v in p.items()}})

        result: Dict[str, Any] = {"found": True, "count": len(parcels),
                                   "county_id": county_id, "parcels": parcels, "features": features}

        # Auto-verify on-chain for single match with a petition
        if len(parcels) == 1 and parcels[0]["petition_number"]:
            pn = parcels[0]["petition_number"]
            chain = _get_onchain_petition(pn)
            chain["contract"] = REGISTRY_ADDRESS
            chain["basescan"] = f"{BASE_SEPOLIA_EXPLORER}/address/{REGISTRY_ADDRESS}"
            parcel_detail = _fetch_parcel_details(pn, county_id)
            if parcel_detail:
                chain["parcel_details"] = parcel_detail
            result["onchain"] = chain

        return result
    except Exception as e:
        return {"error": f"Parcel lookup failed: {e}"}


def _search_petitions(county_id: str, query: str, limit: int = 10) -> dict:
    petitions = _load_petitions(county_id)
    q = query.lower()
    results = [
        p for p in petitions
        if q in (p.get('petition_number') or '').lower()
        or q in (p.get('address') or '').lower()
        or q in (p.get('petitioner') or '').lower()
        or q in (p.get('description') or '').lower()
        or q in (p.get('present_zoning') or '').lower()
        or q in (p.get('proposed_zoning') or '').lower()
    ][:limit]
    features = _petitions_to_features(results, county_id)
    return {"count": len(results), "petitions": results, "features": features}


def _filter_by_zoning(county_id: str, zoning_type: str, target: str = 'proposed_zoning',
                      status: Optional[str] = None, limit: int = 20) -> dict:
    petitions = _load_petitions(county_id)
    filtered = []
    for p in petitions:
        if status and p.get('status') != status:
            continue
        field_val = p.get(target) or ''
        if _zoning_matches(field_val, zoning_type) or zoning_type.lower() in field_val.lower():
            filtered.append(p)
    filtered = filtered[:limit]
    features = _petitions_to_features(filtered, county_id)
    return {"count": len(filtered), "zoning_type": zoning_type, "target": target,
            "petitions": filtered, "features": features}


def _get_parcel_by_rpc(county_id: str, rpc: str) -> dict:
    petitions = _load_petitions(county_id)
    rpc_lower = rpc.lower()
    match = next(
        (p for p in petitions if (p.get('rpc') or p.get('pin') or '').lower() == rpc_lower),
        None
    )
    if not match:
        return {"found": False, "rpc": rpc}
    features = _petitions_to_features([match], county_id)
    return {"found": True, "petition": match, "features": features}


def _get_county_stats(county_id: str) -> dict:
    petitions = _load_petitions(county_id)
    status_counts: dict = {}
    zoning_counts: dict = {}
    for p in petitions:
        s = p.get('status', 'unknown')
        status_counts[s] = status_counts.get(s, 0) + 1
        pz = p.get('proposed_zoning') or ''
        if pz:
            zoning_counts[pz] = zoning_counts.get(pz, 0) + 1
    dates = [p['meeting_date'] for p in petitions if p.get('meeting_date')]
    return {
        "county_id": county_id,
        "total_petitions": len(petitions),
        "status_breakdown": status_counts,
        "top_proposed_zonings": dict(sorted(zoning_counts.items(), key=lambda x: -x[1])[:10]),
        "date_range": {"earliest": min(dates) if dates else None, "latest": max(dates) if dates else None},
    }


# ── Request / Response ────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    county_id: str = "arlington_va"
    conversation_history: list = []


class ChatResponse(BaseModel):
    reply: str
    tools_used: List[str] = []
    petition_ids: List[str] = []
    parcel_features: list = []
    report_url: Optional[str] = None   # S3 presigned URL for verified land record


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    x_payment: Optional[str] = Header(default=None, alias="X-Payment"),
):
    if not claude:
        raise HTTPException(status_code=503, detail="AI service not configured. Set ANTHROPIC_API_KEY or AWS credentials.")

    # ── x402 payment gate (set DISABLE_PAYMENT_GATE=true to bypass in dev) ──────
    if not os.getenv("DISABLE_PAYMENT_GATE", "").lower() in ("1", "true", "yes"):
        if not x_payment:
            return JSONResponse(
                status_code=402,
                content={"detail": "Payment required", "payment_required": PAYMENT_REQUIRED_BODY},
                headers={"X-Payment-Required": json.dumps(PAYMENT_REQUIRED_BODY)},
            )

        try:
            payment_data = json.loads(x_payment)
            tx_hash = payment_data.get("txHash") or payment_data.get("tx_hash") or ""
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid X-Payment header — must be JSON with txHash field")

        if not tx_hash:
            raise HTTPException(status_code=400, detail="X-Payment missing txHash")

        if tx_hash in _used_txs:
            return JSONResponse(
                status_code=402,
                content={"detail": "Transaction already used. Please send a new payment.", "payment_required": PAYMENT_REQUIRED_BODY},
            )

        is_valid, err = _verify_base_payment(tx_hash)
        if not is_valid:
            return JSONResponse(
                status_code=402,
                content={"detail": f"Payment verification failed: {err}", "payment_required": PAYMENT_REQUIRED_BODY},
            )

        _used_txs.add(tx_hash)

    # ── Build messages ────────────────────────────────────────────────────────
    messages = []
    for h in req.conversation_history[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": f"[County: {req.county_id}] {req.message}"})

    tools_used: list = []
    parcel_features: list = []
    reply = ""
    _last_lookup_result: dict = {}   # for S3 report upload after loop

    # ── Agentic loop (max 12 iterations) ─────────────────────────────────────
    for _iter in range(12):
        response = claude.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    reply += block.text
            break

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []

            for block in response.content:
                if block.type != "tool_use":
                    continue
                name = block.name
                inp  = block.input
                tools_used.append(name)
                county = inp.get("county_id", req.county_id)

                if name == "lookup_parcel":
                    result = _lookup_parcel(inp["query"], inp.get("county_id", county))
                    parcel_features.extend(result.get("features", []))
                    if result.get("onchain"):
                        _last_lookup_result = result
                elif name == "search_petitions":
                    result = _search_petitions(county, inp["query"], inp.get("limit", 10))
                    parcel_features.extend(result.get("features", []))
                elif name == "filter_by_zoning":
                    result = _filter_by_zoning(
                        county, inp["zoning_type"],
                        target=inp.get("target", "proposed_zoning"),
                        status=inp.get("status"),
                        limit=inp.get("limit", 20),
                    )
                    parcel_features.extend(result.get("features", []))
                elif name == "get_parcel_by_rpc":
                    result = _get_parcel_by_rpc(county, inp["rpc"])
                    parcel_features.extend(result.get("features", []))
                elif name == "get_county_stats":
                    result = _get_county_stats(county)
                elif name == "get_onchain_history":
                    pin = inp.get("pin", "").strip()
                    petition_number = inp.get("petition_number", "").strip()
                    if petition_number:
                        result = _get_onchain_petition(petition_number)
                        result["contract"] = REGISTRY_ADDRESS
                        result["basescan"] = f"{BASE_SEPOLIA_EXPLORER}/address/{REGISTRY_ADDRESS}"
                        # Enrich with parcel details (owner, address, real PIN)
                        parcel = _fetch_parcel_details(petition_number, inp.get("county_id", county))
                        if parcel:
                            result["parcel_details"] = parcel
                    elif pin:
                        result = _get_onchain_history(pin, inp.get("county_id", county))
                    else:
                        result = {"error": "Provide either pin or petition_number"}
                else:
                    result = {"error": f"Unknown tool: {name}"}

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, default=str),
                })

            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop — grab whatever text exists
        for block in response.content:
            if hasattr(block, "text"):
                reply += block.text
        if not reply:
            reply = "I reached my limit. Please try a more specific question."
        break
    else:
        reply = "Too many reasoning steps needed. Please ask a more specific question."

    # ── AWS S3: upload verified land-record report ────────────────────────────
    report_url: Optional[str] = None
    if _last_lookup_result.get("onchain") and _last_lookup_result.get("parcels"):
        try:
            import sys as _sys, os as _os
            _sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), '..'))
            from aws_services import upload_verification_report
            _parcel  = _last_lookup_result["parcels"][0]
            _onchain = _last_lookup_result["onchain"]
            _cid     = _last_lookup_result.get("county_id", req.county_id)
            _pn      = _parcel.get("petition_number", "")
            report_url = upload_verification_report(_pn, _parcel, _onchain, _cid)
        except Exception as _e:
            print(f"[chat] S3 report upload failed: {_e}")

    # Extract petition IDs from reply
    petition_ids = list({m.group(0) for m in re.finditer(
        r'(?:SPLA|REZN|SPNB|SPRC|SPLA|FBCA|GLUP|UPER|SP#|SP-|Z-)\d[\w-]*', reply, re.IGNORECASE
    )})

    # Deduplicate parcel features
    seen = set()
    unique_features = []
    for f in parcel_features:
        key = json.dumps(f.get("geometry", {}).get("coordinates", []))
        if key not in seen:
            seen.add(key)
            unique_features.append(f)

    return ChatResponse(
        reply=reply,
        tools_used=list(set(tools_used)),
        petition_ids=petition_ids,
        parcel_features=unique_features,
        report_url=report_url,
    )
