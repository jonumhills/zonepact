import { useState, useRef, useEffect } from 'react'
import { getPetitionsByCounty } from '../services/petitions'

const COUNTY_OPTIONS = [
  { id: 'arlington_va', label: 'Arlington, VA', short: 'Arlington County, VA' },
  { id: 'raleigh_nc',   label: 'Raleigh, NC',   short: 'Wake County, NC'      },
]

// ── Layers / Filter dropdown ──────────────────────────────────────────────────

function LayersDropdown({ county, onCountyChange, showParcels, onToggleParcels, showRezoning, onToggleRezoning }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeCount = (showParcels ? 1 : 0) + (showRezoning ? 1 : 0)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={
          open
            ? { background: 'rgba(88,166,255,0.12)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.25)' }
            : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }
        }
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        Layers
        {activeCount < 2 && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl z-50 overflow-hidden py-2"
          style={{
            width: 240,
            background: 'rgba(13,17,23,0.98)',
            border: '1px solid rgba(48,54,61,0.8)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* County */}
          <div className="px-3 pb-2">
            <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5 font-medium">County</p>
            <div className="flex gap-1">
              {COUNTY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onCountyChange?.(c.id); setOpen(false) }}
                  className="flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                  style={
                    county === c.id
                      ? { background: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.25)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/6 mx-3 my-1" />

          {/* Layer toggles */}
          <div className="px-3 pt-1">
            <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5 font-medium">Map Layers</p>
            <div className="space-y-1">
              <ToggleRow
                label="Parcels"
                sub="Show parcel boundaries"
                color="#58a6ff"
                active={showParcels}
                onToggle={() => { onToggleParcels?.() }}
              />
              <ToggleRow
                label="Rezoning pins"
                sub="Show petition markers"
                color="#f59e0b"
                active={showRezoning}
                onToggle={() => { onToggleRezoning?.() }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, sub, color, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors hover:bg-white/4"
    >
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: active ? color : '#374151' }} />
        <div className="text-left">
          <p className={`text-xs font-medium ${active ? 'text-gray-200' : 'text-gray-500'}`}>{label}</p>
          <p className="text-[9px] text-gray-600">{sub}</p>
        </div>
      </div>
      {/* Pill toggle */}
      <div
        className="w-7 h-4 rounded-full transition-colors flex-shrink-0 relative"
        style={{ background: active ? color + '44' : 'rgba(255,255,255,0.06)', border: `1px solid ${active ? color + '60' : 'rgba(255,255,255,0.1)'}` }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{ background: active ? color : '#4b5563', left: active ? '14px' : '1px' }}
        />
      </div>
    </button>
  )
}

// ── Main Header ───────────────────────────────────────────────────────────────

export default function Header({
  county,
  onCountyChange,
  showParcels,
  onToggleParcels,
  showRezoning,
  onToggleRezoning,
}) {
  const currentCounty = COUNTY_OPTIONS.find((c) => c.id === county) ?? COUNTY_OPTIONS[0]
  const petitions     = getPetitionsByCounty(county)
  const liveCount     = petitions.length

  const showLayers = onCountyChange !== undefined   // only show on map page

  return (
    <header
      className="absolute top-0 inset-x-0 z-30 flex items-stretch h-14"
      style={{ background: 'rgba(13,17,23,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(48,54,61,0.8)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 border-r border-white/10 min-w-[148px]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="font-black text-white tracking-tight text-base">ZonePact</span>
      </div>

      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-2 px-4 border-l border-white/10">

        {/* Layers / filter dropdown — only on map page */}
        {showLayers && (
          <>
            <LayersDropdown
              county={county}
              onCountyChange={onCountyChange}
              showParcels={showParcels}
              onToggleParcels={onToggleParcels}
              showRezoning={showRezoning}
              onToggleRezoning={onToggleRezoning}
            />
            <div className="h-4 w-px bg-white/10" />
          </>
        )}

        {/* Location badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span>{currentCounty.short}</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Live count */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-gray-400">
            <span className="text-white font-semibold">{liveCount}</span> live cases
          </span>
        </div>
      </div>
    </header>
  )
}
