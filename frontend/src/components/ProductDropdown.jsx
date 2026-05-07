import { useEffect, useRef } from 'react'
import { STATUS_META } from '../services/petitions'

export default function ProductDropdown({ product, petitions, onClose }) {
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    // small delay so the header click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  if (!product) return null

  return (
    <div
      ref={ref}
      className="absolute top-14 left-[160px] z-40 w-[480px] rounded-xl overflow-hidden"
      style={{
        background: 'rgba(13,17,23,0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(48,54,61,0.9)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/30 to-blue-700/20 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-blue-400">{product.icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-0.5">{product.label}</h3>
            <p className="text-xs text-gray-500">{product.tagline}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed mt-3">
          {product.description}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-white/8 border-b border-white/8">
        {product.stats.map((s) => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className="text-sm font-bold text-white" style={s.color ? { color: s.color } : {}}>
              {s.value}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Feature list */}
      <div className="px-5 py-4">
        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-3">
          What's included
        </p>
        <div className="grid grid-cols-2 gap-2">
          {getFeatures(product.id).map(({ label, sub }) => (
            <div key={label} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <div>
                <p className="text-xs font-medium text-gray-300">{label}</p>
                <p className="text-[10px] text-gray-600">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4">
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-xs font-medium text-blue-300 border border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-500/8 transition-all"
        >
          Explore on the map →
        </button>
      </div>
    </div>
  )
}

function getFeatures(productId) {
  if (productId === 'rezoning') return [
    { label: 'Live petition tracking',  sub: 'Synced from County Board agendas' },
    { label: 'Case number lookup',      sub: 'SP, REZN, SPLA, FBCA & more' },
    { label: 'RPC parcel matching',     sub: 'Auto-links to parcel boundaries' },
    { label: 'Status monitoring',       sub: 'Pending · Approved · Deferred' },
    { label: 'Meeting history',         sub: 'Regular & Recessed meetings' },
    { label: 'CM recommendations',      sub: 'Staff report summaries' },
  ]
  return [
    { label: 'County GIS tileset',       sub: 'Full Arlington parcel boundaries' },
    { label: 'RPC identification',       sub: 'Real Property Code per parcel' },
    { label: 'Zoning designations',      sub: 'Current zoning from GIS data' },
    { label: 'Clickable parcels',        sub: 'Inspect any parcel on the map' },
    { label: 'Petition overlay',         sub: 'See which parcels are in review' },
    { label: 'Address & owner data',     sub: 'From county records' },
  ]
}
