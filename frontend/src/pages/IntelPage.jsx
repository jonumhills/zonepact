import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import ChatInterface from '../components/ChatInterface'
import { getPetitionByRpcForCounty } from '../services/petitions'

const TOKEN    = import.meta.env.VITE_MAPBOX_TOKEN
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const COUNTIES = {
  arlington_va: {
    label:    'Arlington, VA',
    center:   [-77.1022, 38.8809],
    zoom:     13,
    tileset:  import.meta.env.VITE_TILESET_ID || 'manojsrinivasa.4lu3hd4l',
    layer:    import.meta.env.VITE_PARCEL_SOURCE_LAYER || 'arlington_parcels-32zd3y',
    sourceId: 'parcels-arlington',
    countyId: 'arlington_va',
  },
  raleigh_nc: {
    label:    'Raleigh, NC',
    center:   [-78.85, 35.78],
    zoom:     11,
    tileset:  'manojsrinivasa.wake-county-parcels',
    layer:    'parcels',
    sourceId: 'parcels-raleigh',
    countyId: 'raleigh_nc',
  },
}

// ── IntelMap ──────────────────────────────────────────────────────────────────

// ── Parcel info card (floats over map) ────────────────────────────────────────

function ParcelCard({ parcel, onClose }) {
  if (!parcel) return null

  const isRaleigh = parcel._county === 'raleigh_nc' || !!parcel.pin
  const id        = parcel.rpc || parcel.RPC || parcel.pin || parcel.parcel_id || '—'
  const addr      = parcel.site_address || parcel.address || parcel.location || ''
  const zone      = parcel.current_zoning || parcel.present_zoning || ''
  const prop      = parcel.proposed_zoning || ''
  const area      = parcel.area_sqft ? `${Number(parcel.area_sqft).toLocaleString()} sq ft` : null
  const owner     = parcel.owner || ''
  const landUse   = parcel.type_and_use || ''
  const parcelId  = parcel.parcel_id && parcel.parcel_id !== id ? parcel.parcel_id : null

  const petition  = parcel.petition_number ? parcel : null

  const zoneDisplay = zone && prop ? `${zone} → ${prop}` : zone

  return (
    <div
      className="absolute bottom-6 right-4 z-30 rounded-xl overflow-hidden pointer-events-auto flex flex-col"
      style={{ width: 300, maxHeight: '60vh', background: 'rgba(13,17,23,0.97)', border: '1px solid rgba(48,54,61,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
            {isRaleigh ? 'Wake County Parcel' : 'Arlington Parcel'}
          </p>
          <p className="text-sm font-mono font-bold text-white">{id}</p>
          {parcelId && <p className="text-[10px] text-gray-600 font-mono mt-0.5">ID: {parcelId}</p>}
          {petition && (
            <span
              className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              {petition.status ?? 'Petition on file'}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none w-6 h-6 flex items-center justify-center transition-colors flex-shrink-0">×</button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-4 py-3 space-y-2">
        {/* Parcel fields */}
        {addr     && <Row label={isRaleigh ? 'PIN' : 'RPC'} value={id} mono />}
        {addr     && <Row label="Address"  value={addr} />}
        {zone     && <Row label="Zoning"   value={zoneDisplay} highlight={!!prop} />}
        {area     && <Row label="Area"     value={area} />}
        {owner    && <Row label="Owner"    value={owner} />}
        {landUse  && <Row label="Land use" value={landUse} />}

        {/* Petition section */}
        {petition ? (
          <div className="pt-2 mt-1 border-t border-white/6 space-y-2">
            <p className="text-[9px] text-amber-500 uppercase tracking-wider font-medium">Linked Petition</p>
            <Row label="Case #"     value={petition.petition_number} mono />
            <Row label="Petitioner" value={petition.petitioner} />
            <Row label="Change"
              value={(petition.present_zoning || petition.current_zoning) && petition.proposed_zoning
                ? `${petition.present_zoning || petition.current_zoning} → ${petition.proposed_zoning}`
                : null}
              highlight
            />
            <Row label="Meeting" value={petition.meeting_date ? new Date(petition.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
            <Row label="Vote"    value={petition.vote_result} />
            {petition.cm_recommendation && (
              <div>
                <p className="text-[10px] text-gray-600 mb-1">CM Recommendation</p>
                <p className="text-[10px] text-gray-400 leading-relaxed">{petition.cm_recommendation}</p>
              </div>
            )}
            {petition.agenda_url && (
              <a href={petition.agenda_url} target="_blank" rel="noreferrer"
                className="inline-block text-[10px] text-blue-400 hover:underline pt-1">
                View agenda ↗
              </a>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-600 pt-1 border-t border-white/6">No active petition on file</p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, highlight, mono }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="text-[10px] text-gray-600 min-w-[64px] flex-shrink-0 mt-0.5">{label}</span>
      <span className={`text-xs leading-relaxed ${highlight ? 'text-blue-400 font-medium' : mono ? 'font-mono text-gray-300' : 'text-gray-300'}`}>{value}</span>
    </div>
  )
}

// ── IntelMap ──────────────────────────────────────────────────────────────────

function IntelMap({ aiParcels, focusFeature, county, onCountyReady, onParcelClick }) {
  const containerRef   = useRef(null)
  const mapRef         = useRef(null)
  const aiSrcRef       = useRef(null)
  const petitionSrcRef = useRef(null)
  const activeCounty   = useRef(county)   // track without triggering re-init

  // ── Init map once ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container:       containerRef.current,
      style:           'mapbox://styles/mapbox/dark-v11',
      center:          COUNTIES.raleigh_nc.center,
      zoom:            COUNTIES.raleigh_nc.zoom,
      pitchWithRotate: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', async () => {
      // Add both tilesets upfront — show/hide based on active county
      Object.values(COUNTIES).forEach(({ sourceId, tileset, layer }) => {
        map.addSource(sourceId, { type: 'vector', url: `mapbox://${tileset}` })

        map.addLayer({
          id:             `${sourceId}-fill`,
          type:           'fill',
          source:         sourceId,
          'source-layer': layer,
          layout:         { visibility: sourceId === 'parcels-raleigh' ? 'visible' : 'none' },
          paint:          { 'fill-color': '#1e3a5f', 'fill-opacity': 0.3 },
        })
        map.addLayer({
          id:             `${sourceId}-outline`,
          type:           'line',
          source:         sourceId,
          'source-layer': layer,
          layout:         { visibility: sourceId === 'parcels-raleigh' ? 'visible' : 'none' },
          paint: {
            'line-color':   '#2d6a9f',
            'line-width':   ['interpolate', ['linear'], ['zoom'], 11, 0.2, 16, 1.2],
            'line-opacity': 0.5,
          },
        })
      })

      // Petition polygon overlay (orange)
      map.addSource('petition-parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      petitionSrcRef.current = map.getSource('petition-parcels')
      map.addLayer({ id: 'petition-fill',    type: 'fill', source: 'petition-parcels', paint: { 'fill-color': '#f97316', 'fill-opacity': 0.55 } })
      map.addLayer({ id: 'petition-outline', type: 'line', source: 'petition-parcels', paint: { 'line-color': '#fb923c', 'line-width': 2 } })

      // AI highlight overlay (green)
      map.addSource('ai-parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      aiSrcRef.current = map.getSource('ai-parcels')
      map.addLayer({ id: 'ai-fill',    type: 'fill', source: 'ai-parcels', paint: { 'fill-color': '#10b981', 'fill-opacity': 0.65 } })
      map.addLayer({ id: 'ai-outline', type: 'line', source: 'ai-parcels', paint: { 'line-color': '#10b981', 'line-width': 2 } })

      // Register click + hover for BOTH county base layers (needed since both are loaded at init)
      Object.values(COUNTIES).forEach(({ sourceId, countyId }) => {
        const fillId = `${sourceId}-fill`
        map.on('click', fillId, (e) => {
          e.originalEvent.stopPropagation()
          if (e.features?.length) onParcelClick?.(e.features[0].properties, countyId)
        })
        map.on('mouseenter', fillId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', fillId, () => { map.getCanvas().style.cursor = '' })
      })

      // Click + hover for petition / AI overlay layers
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
      ;['petition-fill', 'ai-fill'].forEach((layerId) => {
        map.on('click', layerId, (e) => {
          e.originalEvent.stopPropagation()
          if (e.features?.length) onParcelClick?.(e.features[0].properties, activeCounty.current)
        })
        map.on('mouseenter', layerId, (e) => {
          map.getCanvas().style.cursor = 'pointer'
          const p    = e.features?.[0]?.properties ?? {}
          const id   = p.petition_number || p.rpc || p.pin || ''
          const addr = p.location || p.address || p.site_address || ''
          const zone = p.current_zoning || p.present_zoning || ''
          const prop = p.proposed_zoning || ''
          popup.setLngLat(e.lngLat).setHTML(
            `<div style="font-size:11px;line-height:1.6">
              <strong style="color:#f97316">${id}</strong><br/>
              ${addr ? `<span style="color:#9ca3af">${addr}</span><br/>` : ''}
              ${zone ? `<span style="color:#60a5fa">${zone}${prop ? ` → ${prop}` : ''}</span>` : ''}
            </div>`
          ).addTo(map)
        })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; popup.remove() })
      })

      // Click on empty map → clear card
      const allClickLayers = ['petition-fill', 'ai-fill', ...Object.values(COUNTIES).map((c) => `${c.sourceId}-fill`)]
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: allClickLayers })
        if (!hits.length) onParcelClick?.(null)
      })

      // Load initial petition overlay
      await _loadPetitions(map, activeCounty.current)
      onCountyReady?.()
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to county prop change ────────────────────────────────────────────
  useEffect(() => {
    activeCounty.current = county
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const cfg = COUNTIES[county] || COUNTIES.arlington_va

    // Toggle tileset layer visibility
    Object.values(COUNTIES).forEach(({ sourceId }) => {
      const vis = sourceId === cfg.sourceId ? 'visible' : 'none'
      ;[`${sourceId}-fill`, `${sourceId}-outline`].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
      })
    })

    // Fly to county
    map.flyTo({ center: cfg.center, zoom: cfg.zoom, duration: 1000, essential: true })

    // Clear AI highlights and reload petition overlay
    if (aiSrcRef.current) aiSrcRef.current.setData({ type: 'FeatureCollection', features: [] })
    _loadPetitions(map, county)
  }, [county])

  // ── Update AI highlights ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !aiSrcRef.current) return

    if (!aiParcels?.length) {
      aiSrcRef.current.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    aiSrcRef.current.setData({ type: 'FeatureCollection', features: aiParcels })

    const coords = aiParcels.flatMap((f) => {
      if (f.geometry?.type === 'Point')        return [f.geometry.coordinates]
      if (f.geometry?.type === 'Polygon')      return f.geometry.coordinates[0] || []
      if (f.geometry?.type === 'MultiPolygon') return f.geometry.coordinates.flatMap((p) => p[0] || [])
      return []
    }).filter(Boolean)

    if (coords.length > 0) {
      const lngs = coords.map((c) => c[0])
      const lats  = coords.map((c) => c[1])
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 80, maxZoom: 15, duration: 1200 }
      )
    }
  }, [aiParcels])

  // ── Focus / fly-to a single petition feature (from badge click) ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !focusFeature) return

    // Add/update a separate highlight source for the focused feature
    const src = map.getSource('focus-parcel')
    const fc  = { type: 'FeatureCollection', features: [focusFeature] }
    if (src) {
      src.setData(fc)
    } else {
      map.addSource('focus-parcel', { type: 'geojson', data: fc })
      map.addLayer({ id: 'focus-fill',    type: 'fill', source: 'focus-parcel', paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.6 } })
      map.addLayer({ id: 'focus-outline', type: 'line', source: 'focus-parcel', paint: { 'line-color': '#fbbf24', 'line-width': 2.5 } })
    }

    // Fly to the feature
    const geom   = focusFeature.geometry
    const coords = geom?.type === 'Point'        ? [geom.coordinates]
                 : geom?.type === 'Polygon'      ? geom.coordinates[0] || []
                 : geom?.type === 'MultiPolygon' ? geom.coordinates.flatMap((p) => p[0] || [])
                 : []
    if (coords.length > 0) {
      const lngs = coords.map((c) => c[0])
      const lats  = coords.map((c) => c[1])
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 120, maxZoom: 17, duration: 900 }
      )
    }
  }, [focusFeature])

  return <div ref={containerRef} className="w-full h-full" />
}

async function _loadPetitions(map, countyId) {
  try {
    const res   = await fetch(`${API_BASE}/api/parcels/geojson?county_id=${countyId}`)
    if (!res.ok) return
    const geojson = await res.json()
    const feats   = (geojson.features || []).filter(f => f.geometry?.coordinates)
    const src     = map.getSource('petition-parcels')
    if (src) src.setData({ type: 'FeatureCollection', features: feats })
  } catch (_) { /* backend not running — silently skip */ }
}

// ── County selector ───────────────────────────────────────────────────────────

function CountySelector({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {Object.entries(COUNTIES).map(([id, c]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium"
          style={
            value === id
              ? { background: 'rgba(88,166,255,0.18)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }
          }
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelPage() {
  const navigate = useNavigate()
  const [aiParcels,       setAiParcels]       = useState([])
  const [focusFeature,    setFocusFeature]    = useState(null)
  const [county,          setCounty]          = useState('raleigh_nc')
  const [parcelCount,     setParcelCount]     = useState(0)
  const [selectedParcel,  setSelectedParcel]  = useState(null)

  const handleParcelsUpdate = useCallback((features) => {
    setAiParcels(features)
    setParcelCount(features.length)
  }, [])

  const handleCountyChange = useCallback((id) => {
    setCounty(id)
    setAiParcels([])
    setParcelCount(0)
    setSelectedParcel(null)
    setFocusFeature(null)
  }, [])

  const handlePetitionClick = useCallback(async (petitionNumber) => {
    // Check aiParcels first
    const existing = aiParcels.find((f) => f.properties?.petition_number === petitionNumber)
    if (existing) {
      setSelectedParcel({ ...existing.properties, _county: county })
      setFocusFeature(existing)
      return
    }
    // Fetch parcel polygon from API
    try {
      const res = await fetch(
        `${API_BASE}/api/parcels/geojson?county_id=${county}&petition_number=${encodeURIComponent(petitionNumber)}`
      )
      const data = await res.json()
      if (data.features?.length) {
        const f = data.features[0]
        setSelectedParcel({ ...f.properties, _county: county })
        setFocusFeature(f)
      }
    } catch (e) {
      console.warn('Could not fetch parcel for', petitionNumber)
    }
  }, [aiParcels, county])

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0d1117] flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 z-10"
        style={{ borderBottom: '1px solid rgba(48,54,61,0.7)', background: 'rgba(13,17,23,0.96)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Home
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-sm font-semibold text-white">Intelligence</span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)' }}>
              x402
            </span>
            {/* AWS services indicator */}
            <div className="hidden sm:flex items-center gap-1">
              {['Bedrock', 'S3', 'SNS'].map((svc) => (
                <span key={svc} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                  {svc}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CountySelector value={county} onChange={handleCountyChange} />
          {parcelCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {parcelCount} parcels highlighted
            </div>
          )}
          <button
            onClick={() => navigate('/map')}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            Full Map
          </button>
        </div>
      </div>

      {/* ── Body: 25% chat / 75% map ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden"
          style={{
            width: '25%', minWidth: 280, maxWidth: 400,
            borderRight: '1px solid rgba(48,54,61,0.7)',
            background: 'rgba(13,17,23,0.97)',
          }}
        >
          <ChatInterface onParcelsUpdate={handleParcelsUpdate} county={county} onPetitionClick={handlePetitionClick} />
        </div>

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <IntelMap
            aiParcels={aiParcels}
            focusFeature={focusFeature}
            county={county}
            onParcelClick={(props, countyId) => {
              if (!props) { setSelectedParcel(null); return }
              const rpc = props.rpc || props.RPC || props.pin || props.parcel_id
              const petition = rpc ? getPetitionByRpcForCounty(rpc, countyId || county) : null
              setSelectedParcel(petition ? { ...props, ...petition, _county: countyId || county } : { ...props, _county: countyId || county })
            }}
          />

          {parcelCount === 0 && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs text-gray-400 pointer-events-none"
              style={{ background: 'rgba(13,17,23,0.85)', border: '1px solid rgba(48,54,61,0.7)', backdropFilter: 'blur(8px)' }}
            >
              {COUNTIES[county].label} · Ask the AI a question → parcels highlight here
            </div>
          )}

          {parcelCount > 0 && (
            <div
              className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', backdropFilter: 'blur(8px)' }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-medium">{parcelCount} AI-identified parcels</span>
              <button
                onClick={() => { setAiParcels([]); setParcelCount(0) }}
                className="text-emerald-600 hover:text-emerald-400 ml-1 transition-colors pointer-events-auto"
              >×</button>
            </div>
          )}

          {/* Parcel detail card */}
          <ParcelCard parcel={selectedParcel} onClose={() => setSelectedParcel(null)} />
        </div>
      </div>
    </div>
  )
}
