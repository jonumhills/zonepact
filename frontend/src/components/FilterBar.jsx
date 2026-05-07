const STATES   = [{ id: 'va', label: 'Virginia' }]
const COUNTIES = [{ id: 'arlington', label: 'Arlington' }]

export default function FilterBar({ showParcels, showRezoning, onToggleParcels, onToggleRezoning, panelOpen }) {
  const left = panelOpen ? 'left-[372px]' : 'left-4'

  return (
    <div className={`absolute top-[68px] z-20 flex items-center gap-2 transition-all duration-300 ${left}`}>
      {/* Geo selectors */}
      <GeoSelect label="Virginia" icon={<FlagIcon />} disabled hint="More states coming soon" />
      <GeoSelect label="Arlington" icon={<BuildingIcon />} disabled hint="More counties coming soon" />

      <div className="h-5 w-px bg-white/15 mx-1" />

      {/* Layer toggles */}
      <LayerToggle
        active={showParcels}
        onClick={onToggleParcels}
        color="#58a6ff"
        label="Parcels"
        icon={<ParcelIcon />}
      />
      <LayerToggle
        active={showRezoning}
        onClick={onToggleRezoning}
        color="#f59e0b"
        label="Rezoning"
        icon={<RezoningIcon />}
      />
    </div>
  )
}

function GeoSelect({ label, icon, disabled, hint }) {
  return (
    <button
      disabled={disabled}
      title={hint}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-300 border border-white/15 transition-colors cursor-default"
      style={{ background: 'rgba(13,17,23,0.82)', backdropFilter: 'blur(12px)' }}
    >
      {icon}
      {label}
      <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
  )
}

function LayerToggle({ active, onClick, color, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'text-white border-transparent'
          : 'text-gray-400 border-white/15 hover:border-white/25 hover:text-gray-300'
      }`}
      style={{
        background: active
          ? `linear-gradient(135deg, ${color}22, ${color}18), rgba(13,17,23,0.82)`
          : 'rgba(13,17,23,0.82)',
        borderColor: active ? `${color}60` : undefined,
        backdropFilter: 'blur(12px)',
      }}
    >
      <span style={{ color: active ? color : undefined }}>{icon}</span>
      {label}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: active ? color : '#374151' }}
      />
    </button>
  )
}

/* ── Inline SVG icons ─────────────────────────────── */
function FlagIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 6l9-3 9 3-9 3-9-3z" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}
function ParcelIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-8.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  )
}
function RezoningIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.621 9.879a3.375 3.375 0 00-4.242 0M8.25 12h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
