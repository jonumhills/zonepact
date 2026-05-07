import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Map from '../components/Map'
import Header from '../components/Header'
import ParcelDrawer from '../components/ParcelDrawer'
import { getPetitionsByCounty, getPetitionByRpcForCounty } from '../services/petitions'

export default function MapPage() {
  const navigate = useNavigate()
  const mapRef   = useRef(null)

  const [county,       setCounty]       = useState('arlington_va')
  const [showParcels,  setShowParcels]  = useState(true)
  const [showRezoning, setShowRezoning] = useState(true)

  const [selectedPetition, setSelectedPetition] = useState(null)
  const [clickedParcel,    setClickedParcel]     = useState(null)

  const petitions = getPetitionsByCounty(county)

  const handleParcelClick = useCallback((props) => {
    setClickedParcel(props)
    const rpc = props?.rpc || props?.RPC || props?.pin || props?.parcel_id || null
    const linked = rpc ? getPetitionByRpcForCounty(rpc, county) : null
    setSelectedPetition(linked)
  }, [county])

  const handlePinClick = useCallback((petition) => {
    setSelectedPetition(petition)
    setClickedParcel(null)
    if (petition.coords) mapRef.current?.flyTo(petition.coords)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setClickedParcel(null)
    setSelectedPetition(null)
  }, [])

  const handleCountyChange = useCallback((id) => {
    setCounty(id)
    setClickedParcel(null)
    setSelectedPetition(null)
  }, [])

  const drawerVisible = !!(clickedParcel || selectedPetition)
  const highlightRpc  = selectedPetition?.rpc ?? selectedPetition?.pin ?? null

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d1117]">

      {/* Full-screen map */}
      <div className="absolute inset-0">
        <Map
          ref={mapRef}
          petitions={petitions}
          county={county}
          selectedRpc={highlightRpc}
          showParcels={showParcels}
          showRezoning={showRezoning}
          onParcelClick={handleParcelClick}
          onPinClick={handlePinClick}
        />
      </div>

      {/* Header */}
      <Header
        county={county}
        onCountyChange={handleCountyChange}
        showParcels={showParcels}
        onToggleParcels={() => setShowParcels((v) => !v)}
        showRezoning={showRezoning}
        onToggleRezoning={() => setShowRezoning((v) => !v)}
      />

      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-[18px] left-[160px] z-40 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Home
      </button>

      {/* Legend */}
      <div
        className="absolute bottom-10 right-4 z-10 px-3 py-2.5 rounded-xl text-xs space-y-1.5"
        style={{ background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(48,54,61,0.7)' }}
      >
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-medium">
          {county === 'raleigh_nc' ? 'Raleigh, NC' : 'Arlington, VA'} · Petition status
        </p>
        {[
          { color: '#f59e0b', label: 'Pending'     },
          { color: '#10b981', label: 'Approved'    },
          { color: '#ef4444', label: 'Denied'      },
          { color: '#facc15', label: 'Deferred'    },
          { color: '#1e3a5f', label: 'No petition' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-white/10" style={{ background: color }} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Detail drawer — bottom of screen on parcel/pin click */}
      {drawerVisible && (
        <ParcelDrawer
          parcelProps={clickedParcel}
          petition={selectedPetition}
          county={county}
          onClose={handleDrawerClose}
        />
      )}
    </div>
  )
}
