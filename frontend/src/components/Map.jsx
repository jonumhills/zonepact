import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const COUNTY_CONFIGS = {
  arlington_va: {
    center:   [-77.1022, 38.8809],
    zoom:     14,
    tileset:  import.meta.env.VITE_TILESET_ID || 'manojsrinivasa.4lu3hd4l',
    layer:    import.meta.env.VITE_PARCEL_SOURCE_LAYER || 'arlington_parcels-32zd3y',
    rpcField: import.meta.env.VITE_PARCEL_RPC_FIELD || 'rpc',
    geocodeBbox:   '-77.25,38.83,-77.03,38.93',
    geocodeCity:   'Arlington, VA',
  },
  raleigh_nc: {
    center:   [-78.85, 35.78],
    zoom:     11,
    tileset:  'manojsrinivasa.wake-county-parcels',
    layer:    'parcels',
    rpcField: 'pin',
    geocodeBbox:   '-79.0,35.5,-78.5,36.1',
    geocodeCity:   'Raleigh, NC',
  },
}

const STATUS_COLORS = {
  pending:   '#f59e0b',
  approved:  '#10b981',
  denied:    '#ef4444',
  deferred:  '#facc15',
  withdrawn: '#9ca3af',
  unknown:   '#6b7280',
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocodeAddress(address, token, cfg) {
  const query = encodeURIComponent(`${address}, ${cfg.geocodeCity}`)
  const url   = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&bbox=${cfg.geocodeBbox}&limit=1`
  try {
    const res  = await fetch(url)
    const data = await res.json()
    if (data.features?.length) return data.features[0].center
  } catch { /* silent */ }
  return null
}

async function resolveCoords(petitions, token, cfg) {
  return Promise.all(
    petitions.map(async (p) => {
      if (p.latitude && p.longitude) return { ...p, coords: [p.longitude, p.latitude] }
      const addr = p.address || p.site_address
      if (addr) {
        const clean  = addr.split(/\s*\(RPC|\s*and\s+a\s+portion/i)[0].trim()
        const coords = await geocodeAddress(clean, token, cfg)
        return { ...p, coords }
      }
      return { ...p, coords: null }
    })
  )
}

// ── GeoJSON ───────────────────────────────────────────────────────────────────

function toGeoJSON(petitionsWithCoords) {
  return {
    type: 'FeatureCollection',
    features: petitionsWithCoords
      .filter((p) => p.coords)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: p.coords },
        properties: {
          id:              p.id,
          petition_number: p.petition_number ?? '',
          status:          p.status ?? 'unknown',
          address:         p.address ?? p.site_address ?? '',
          rpc:             p.rpc ?? p.pin ?? '',
          present_zoning:  p.present_zoning ?? p.current_zoning ?? '',
          proposed_zoning: p.proposed_zoning ?? '',
          color:           STATUS_COLORS[p.status] ?? STATUS_COLORS.unknown,
        },
      })),
  }
}

// ── Helper: prefix → all layer IDs for a county ───────────────────────────────

function layerIds(prefix) {
  return {
    base:             `${prefix}-base`,
    outline:          `${prefix}-outline`,
    petitioned:       `${prefix}-petitioned`,
    petitionedOutline:`${prefix}-petitioned-outline`,
    hover:            `${prefix}-hover`,
    selected:         `${prefix}-selected`,
    selectedOutline:  `${prefix}-selected-outline`,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const Map = forwardRef(function Map(
  { petitions = [], county = 'arlington_va', selectedRpc, showParcels, showRezoning, onParcelClick, onPinClick },
  ref
) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const markersRef    = useRef([])
  const activeCounty  = useRef(county)   // tracks current county without re-init

  useImperativeHandle(ref, () => ({
    flyTo(coords, zoom = 15) {
      mapRef.current?.flyTo({ center: coords, zoom, duration: 1200, essential: true })
    },
    resetView() {
      const cfg = COUNTY_CONFIGS[activeCounty.current] || COUNTY_CONFIGS.arlington_va
      mapRef.current?.flyTo({ center: cfg.center, zoom: cfg.zoom, duration: 800 })
    },
  }))

  // ── Build / refresh pin markers ────────────────────────────────────────────
  const refreshMarkers = useCallback((petitionsWithCoords, map) => {
    markersRef.current.forEach((m) => m.marker.remove())
    markersRef.current = []

    petitionsWithCoords.filter((p) => p.coords).forEach((p) => {
      const el       = document.createElement('div')
      el.className   = `petition-marker ${p.status ?? 'unknown'}`
      el.innerHTML   = '<div class="pin-pulse"></div><div class="pin-dot"></div>'
      el.title       = `${p.petition_number ?? ''} · ${p.address ?? p.site_address ?? ''}`
      el.addEventListener('click', (e) => { e.stopPropagation(); onPinClick?.(p) })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(p.coords)
        .addTo(map)
      markersRef.current.push({ marker, petition: p })
    })
  }, [onPinClick])

  // ── Add all layers for one county ─────────────────────────────────────────
  function addCountyLayers(map, countryId, visible) {
    const cfg    = COUNTY_CONFIGS[countryId]
    const prefix = countryId === 'arlington_va' ? 'arlington' : 'raleigh'
    const srcId  = `parcels-${prefix}`
    const ids    = layerIds(prefix)
    const vis    = visible ? 'visible' : 'none'
    const rpcFld = cfg.rpcField

    map.addSource(srcId, { type: 'vector', url: `mapbox://${cfg.tileset}` })

    map.addLayer({ id: ids.base, type: 'fill', source: srcId, 'source-layer': cfg.layer,
      layout: { visibility: vis },
      paint: { 'fill-color': '#1e3a5f', 'fill-opacity': 0.35 } })

    map.addLayer({ id: ids.outline, type: 'line', source: srcId, 'source-layer': cfg.layer,
      layout: { visibility: vis },
      paint: { 'line-color': '#2d6a9f', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 16, 1.2], 'line-opacity': 0.7 } })

    map.addLayer({ id: ids.petitioned, type: 'fill', source: srcId, 'source-layer': cfg.layer,
      filter: ['==', 1, 0],
      layout: { visibility: vis },
      paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.55 } })

    map.addLayer({ id: ids.petitionedOutline, type: 'line', source: srcId, 'source-layer': cfg.layer,
      filter: ['==', 1, 0],
      layout: { visibility: vis },
      paint: { 'line-color': '#f59e0b', 'line-width': 2 } })

    map.addLayer({ id: ids.hover, type: 'fill', source: srcId, 'source-layer': cfg.layer,
      filter: ['==', ['get', rpcFld], ''],
      layout: { visibility: vis },
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } })

    map.addLayer({ id: ids.selected, type: 'fill', source: srcId, 'source-layer': cfg.layer,
      filter: ['==', ['get', rpcFld], ''],
      layout: { visibility: vis },
      paint: { 'fill-color': '#58a6ff', 'fill-opacity': 0.65 } })

    map.addLayer({ id: ids.selectedOutline, type: 'line', source: srcId, 'source-layer': cfg.layer,
      filter: ['==', ['get', rpcFld], ''],
      layout: { visibility: vis },
      paint: { 'line-color': '#58a6ff', 'line-width': 2.5 } })

    // Hover interaction
    let hoveredRpc = ''
    map.on('mousemove', ids.base, (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const rpc = e.features?.[0]?.properties?.[rpcFld] ?? ''
      if (rpc !== hoveredRpc) {
        hoveredRpc = rpc
        if (map.getLayer(ids.hover)) map.setFilter(ids.hover, ['==', ['get', rpcFld], rpc])
      }
    })
    map.on('mouseleave', ids.base, () => {
      map.getCanvas().style.cursor = ''
      hoveredRpc = ''
      if (map.getLayer(ids.hover)) map.setFilter(ids.hover, ['==', ['get', rpcFld], ''])
    })

    // Click → parcel detail
    map.on('click', ids.base, (e) => {
      if (!e.features?.length) return
      onParcelClick?.(e.features[0].properties, e.lngLat)
    })
  }

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const initCfg = COUNTY_CONFIGS[county] || COUNTY_CONFIGS.arlington_va

    const map = new mapboxgl.Map({
      container:       containerRef.current,
      style:           'mapbox://styles/mapbox/dark-v11',
      center:          initCfg.center,
      zoom:            initCfg.zoom,
      pitchWithRotate: false,
    })
    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    map.on('load', async () => {
      // Add both county layers at init — only active county visible
      addCountyLayers(map, 'arlington_va', county === 'arlington_va')
      addCountyLayers(map, 'raleigh_nc',   county === 'raleigh_nc')

      // Load petition markers for current county
      const cfg = COUNTY_CONFIGS[county] || COUNTY_CONFIGS.arlington_va
      resolveCoords(petitions, TOKEN, cfg).then((withCoords) => {
        if (!mapRef.current) return
        refreshMarkers(withCoords, map)

        // Highlight petitioned parcels on active county's layer
        const prefix = county === 'arlington_va' ? 'arlington' : 'raleigh'
        const ids    = layerIds(prefix)
        const rpcs   = withCoords.map((p) => p.rpc ?? p.pin).filter(Boolean)
        const filterExpr = rpcs.length
          ? ['in', ['get', cfg.rpcField], ['literal', rpcs]]
          : ['==', 1, 0]
        if (map.getLayer(ids.petitioned))       map.setFilter(ids.petitioned, filterExpr)
        if (map.getLayer(ids.petitionedOutline)) map.setFilter(ids.petitionedOutline, filterExpr)
      })
    })

    return () => {
      markersRef.current.forEach((m) => m.marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── County switching ───────────────────────────────────────────────────────
  useEffect(() => {
    activeCounty.current = county
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const cfg    = COUNTY_CONFIGS[county] || COUNTY_CONFIGS.arlington_va
    const prefix = county === 'arlington_va' ? 'arlington' : 'raleigh'

    // Toggle all layer visibilities
    ;['arlington', 'raleigh'].forEach((p) => {
      const ids  = layerIds(p)
      const vis  = p === prefix ? 'visible' : 'none'
      Object.values(ids).forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
      })
    })

    // Fly to new county
    map.flyTo({ center: cfg.center, zoom: cfg.zoom, duration: 900, essential: true })

    // Refresh petition markers for new county
    resolveCoords(petitions, TOKEN, cfg).then((withCoords) => {
      if (!mapRef.current) return
      refreshMarkers(withCoords, map)
      const ids  = layerIds(prefix)
      const rpcs = withCoords.map((p) => p.rpc ?? p.pin).filter(Boolean)
      const filterExpr = rpcs.length
        ? ['in', ['get', cfg.rpcField], ['literal', rpcs]]
        : ['==', 1, 0]
      if (map.getLayer(ids.petitioned))       map.setFilter(ids.petitioned, filterExpr)
      if (map.getLayer(ids.petitionedOutline)) map.setFilter(ids.petitionedOutline, filterExpr)
    })
  }, [county, petitions, refreshMarkers])

  // ── Layer visibility toggles ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const vis = showParcels ? 'visible' : 'none'
    ;['arlington', 'raleigh'].forEach((p) => {
      Object.values(layerIds(p)).forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
      })
    })
  }, [showParcels])

  useEffect(() => {
    markersRef.current.forEach(({ marker }) => {
      marker.getElement().style.display = showRezoning ? '' : 'none'
    })
  }, [showRezoning])

  // ── Selected RPC highlight ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const cfg    = COUNTY_CONFIGS[activeCounty.current] || COUNTY_CONFIGS.arlington_va
    const prefix = activeCounty.current === 'arlington_va' ? 'arlington' : 'raleigh'
    const ids    = layerIds(prefix)
    const rpc    = selectedRpc || ''
    const f      = rpc ? ['==', ['get', cfg.rpcField], rpc] : ['==', 1, 0]
    if (map.getLayer(ids.selected))       map.setFilter(ids.selected, f)
    if (map.getLayer(ids.selectedOutline)) map.setFilter(ids.selectedOutline, f)
  }, [selectedRpc])

  useEffect(() => {
    markersRef.current.forEach(({ marker, petition }) => {
      const id = petition.rpc ?? petition.pin ?? ''
      marker.getElement().classList.toggle('selected', id === selectedRpc)
    })
  }, [selectedRpc])

  return <div ref={containerRef} className="w-full h-full" />
})

export default Map
