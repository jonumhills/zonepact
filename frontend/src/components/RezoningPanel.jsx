import { useState } from 'react'
import { STATUS_META } from '../services/petitions'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'denied', 'deferred']

export default function RezoningPanel({ petitions, selected, onSelect }) {
  const [query,  setQuery]  = useState('')
  const [filter, setFilter] = useState('all')

  const visible = petitions.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      p.petition_number?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.petitioner?.toLowerCase().includes(q) ||
      p.rpc?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    )
  })

  const countFor = (s) => s === 'all' ? petitions.length : petitions.filter(p => p.status === s).length

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-sm font-bold text-white mb-0.5">Rezoning Petitions</h2>
        <p className="text-xs text-gray-500">
          Site plans, rezonings &amp; land-use cases · Arlington County Board
        </p>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search case, address, RPC…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {STATUS_FILTERS.map((s) => {
          const cnt = countFor(s)
          if (cnt === 0 && s !== 'all') return null
          const meta = STATUS_META[s] ?? { label: 'All', color: '#6b7280' }
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                filter === s
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {s !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              )}
              {s === 'all' ? 'All' : meta.label}
              <span className="opacity-50 text-[10px]">{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mx-3 mb-1" />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs">
            <span className="text-2xl mb-2">🏛️</span>
            No cases match
          </div>
        ) : (
          visible.map((p) => (
            <PetitionRow
              key={p.id}
              petition={p}
              active={selected?.id === p.id}
              onClick={() => onSelect(p)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function PetitionRow({ petition, active, onClick }) {
  const meta = STATUS_META[petition.status] ?? STATUS_META.unknown
  const date = petition.meeting_date
    ? new Date(petition.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all group ${
        active
          ? 'bg-blue-500/10 border-l-2 border-l-blue-400'
          : 'hover:bg-white/3 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono font-bold text-blue-400 leading-tight">
          {petition.petition_number ?? '—'}
        </span>
        <StatusPill meta={meta} />
      </div>

      {petition.address && (
        <p className="text-xs text-gray-300 truncate mb-1">{petition.address}</p>
      )}

      {(petition.present_zoning || petition.proposed_zoning) && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
          <span className="bg-white/8 rounded px-1.5 py-0.5">{petition.present_zoning ?? '?'}</span>
          <span>→</span>
          <span className="bg-blue-900/40 text-blue-300 rounded px-1.5 py-0.5">{petition.proposed_zoning ?? '?'}</span>
        </div>
      )}

      {!petition.address && petition.description && (
        <p className="text-[10px] text-gray-600 line-clamp-2 mb-1">{petition.description}</p>
      )}

      <div className="flex items-center justify-between">
        {petition.rpc && (
          <span className="text-[10px] text-gray-600 font-mono">RPC {petition.rpc}</span>
        )}
        {date && <span className="text-[10px] text-gray-600 ml-auto">{date}</span>}
      </div>
    </button>
  )
}

function StatusPill({ meta }) {
  return (
    <span
      className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}33` }}
    >
      {meta.label}
    </span>
  )
}
