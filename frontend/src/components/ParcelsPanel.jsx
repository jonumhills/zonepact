// Tileset fields: rpc (String), parcel_id (String), area_sqft (Number)

export default function ParcelsPanel({ clickedParcel, petition }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-sm font-bold text-white mb-0.5">Parcel Explorer</h2>
        <p className="text-xs text-gray-500">
          Arlington County · {clickedParcel ? 'Parcel selected' : 'Click any parcel'}
        </p>
      </div>
      <div className="h-px bg-white/5 mx-3 mb-3" />

      {clickedParcel ? (
        <SelectedParcel props={clickedParcel} petition={petition} />
      ) : (
        <EmptyState />
      )}

      <div className="mt-auto px-4 pb-4">
        <div className="rounded-lg border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Parcel data from tileset <span className="font-mono text-gray-500">manojsrinivasa.4lu3hd4l</span> · layer <span className="font-mono text-gray-500">arlington_parcels-32zd3y</span> · fields: rpc · parcel_id · area_sqft
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-300 text-center mb-2">Click any parcel on the map</p>
      <p className="text-xs text-gray-600 text-center leading-relaxed">
        Parcel boundaries are visible at zoom 13+. Select any boundary to view its RPC and area — plus any linked rezoning petition.
      </p>
      <div className="mt-6 w-full space-y-2">
        {[
          { dot: '#2d6a9f', label: 'Parcel boundary',     sub: 'All ~25k Arlington parcels' },
          { dot: '#f59e0b', label: 'Petitioned parcel',   sub: 'Has active rezoning case' },
          { dot: '#58a6ff', label: 'Selected parcel',     sub: 'Currently highlighted' },
        ].map(({ dot, label, sub }) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="w-3 h-3 rounded-sm border border-white/15 flex-shrink-0" style={{ background: dot }} />
            <div>
              <p className="text-xs font-medium text-gray-300">{label}</p>
              <p className="text-[10px] text-gray-600">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectedParcel({ props, petition }) {
  const rpc       = props?.rpc || props?.RPC
  const parcelId  = props?.parcel_id
  const areaSqft  = props?.area_sqft ? Number(props.area_sqft).toLocaleString() : null

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3">
      {/* RPC card */}
      <div className="px-3 py-3 rounded-lg mb-3 border border-blue-500/20" style={{ background: 'rgba(88,166,255,0.06)' }}>
        <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-0.5">Real Property Code</p>
        <p className="text-sm font-mono font-bold text-white">{rpc ?? '—'}</p>
        {parcelId && parcelId !== rpc && (
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">parcel_id: {parcelId}</p>
        )}
      </div>

      {/* Fields */}
      <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1 mb-2 font-medium">Tileset data</p>
      <div className="space-y-1 mb-4">
        {rpc      && <DataRow k="rpc"       v={rpc} />}
        {parcelId && <DataRow k="parcel_id" v={parcelId} />}
        {areaSqft && <DataRow k="area_sqft" v={`${areaSqft} sq ft`} />}
      </div>

      {/* Petition link */}
      {petition && (
        <>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider px-1 mb-2 font-medium">Linked petition</p>
          <div className="px-3 py-2.5 rounded-lg border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-xs font-mono font-bold text-amber-400">{petition.petition_number}</p>
            <p className="text-xs text-gray-400 mt-0.5">{petition.address || petition.description?.slice(0,80)}</p>
            {petition.present_zoning && petition.proposed_zoning && (
              <p className="text-xs text-blue-400 font-medium mt-1">
                {petition.present_zoning} → {petition.proposed_zoning}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DataRow({ k, v }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/4 transition-colors">
      <span className="text-[10px] text-gray-600 font-mono min-w-[72px] flex-shrink-0 mt-0.5">{k}</span>
      <span className="text-xs text-gray-300 break-all">{v}</span>
    </div>
  )
}
