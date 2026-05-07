import { STATUS_META } from '../services/petitions'

export default function ParcelDrawer({ parcelProps, petition, county = 'arlington_va', onClose }) {
  if (!parcelProps && !petition) return null

  const isRaleigh = county === 'raleigh_nc'
  const status    = petition ? (STATUS_META[petition.status] ?? STATUS_META.unknown) : null

  // Normalise identifier field across counties
  const rpc = parcelProps?.rpc || parcelProps?.RPC || parcelProps?.pin || petition?.rpc || petition?.pin

  return (
    <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pointer-events-none">
      <div
        className="pointer-events-auto rounded-xl border border-white/10 overflow-hidden flex flex-col"
        style={{ background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.6)', maxHeight: '44vh' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div>
              <span className="text-xs font-mono font-bold text-white">
                {rpc ?? 'Parcel'}
              </span>
              {parcelProps?.parcel_id && parcelProps.parcel_id !== rpc && (
                <span className="text-xs text-gray-500 ml-2 font-mono">
                  ID: {parcelProps.parcel_id}
                </span>
              )}
            </div>
            {petition && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: `${status.color}18`, color: status.color, border: `1px solid ${status.color}33` }}
              >
                {status.label}
              </span>
            )}
            {!petition && parcelProps && (
              <span className="text-[10px] text-gray-600">No active petition</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 transition-colors text-xl leading-none w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Two columns — flex-1 so they fill remaining height and scroll independently */}
        <div className="grid grid-cols-2 divide-x divide-white/8 flex-1 min-h-0">

          {/* Parcel column */}
          <div className="px-5 py-4 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-3 font-medium">
              Parcel · {isRaleigh ? 'Wake County GIS' : 'Arlington GIS'}
            </p>
            <dl className="space-y-2.5">
              <FieldRow label={isRaleigh ? 'PIN' : 'RPC'} value={rpc} mono />
              {!isRaleigh && <FieldRow label="Parcel ID" value={parcelProps?.parcel_id} mono />}
              <FieldRow label="Address"
                value={parcelProps?.site_address || parcelProps?.address || petition?.address} />
              <FieldRow label="Area"
                value={parcelProps?.area_sqft ? `${Number(parcelProps.area_sqft).toLocaleString()} sq ft` : null} />
              <FieldRow label="Zoning"
                value={parcelProps?.current_zoning || petition?.present_zoning || petition?.current_zoning} />
              {isRaleigh && <FieldRow label="Owner"     value={parcelProps?.owner} />}
              {isRaleigh && <FieldRow label="Land use"  value={parcelProps?.type_and_use} />}
            </dl>
          </div>

          {/* Petition column */}
          <div className="px-5 py-4 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-3 font-medium">
              {petition ? 'Active Petition' : 'No Active Petition'}
            </p>

            {petition ? (
              <div className="space-y-2">
                <FieldRow label="Case #"         value={petition.petition_number} mono />
                <FieldRow label="Type"           value={getPetitionType(petition.petition_number)} />
                <FieldRow label="Petitioner"     value={petition.petitioner} />
                <FieldRow label="Zoning change"
                  value={(petition.present_zoning || petition.current_zoning) && petition.proposed_zoning
                    ? `${petition.present_zoning || petition.current_zoning} → ${petition.proposed_zoning}`
                    : null}
                  highlight
                />
                <FieldRow label="Meeting"        value={formatDate(petition.meeting_date)} />
                <FieldRow label="Vote"           value={petition.vote_result} />
                {petition.cm_recommendation && (
                  <div className="pt-1">
                    <p className="text-[10px] text-gray-600 mb-1">CM Recommendation</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-3">
                      {petition.cm_recommendation}
                    </p>
                  </div>
                )}
                {petition.agenda_url && (
                  <a
                    href={petition.agenda_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block pt-1 text-[10px] text-blue-400 hover:underline"
                  >
                    View agenda ↗
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600">
                No rezoning petition is on file for this parcel in our current dataset.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, value, highlight, mono }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[10px] text-gray-600">{label}</dt>
      <dd className={`text-xs mt-0.5 ${
        highlight ? 'text-blue-400 font-medium' : mono ? 'font-mono text-gray-200' : 'text-gray-300'
      }`}>
        {value}
      </dd>
    </div>
  )
}

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function getPetitionType(caseNum) {
  if (!caseNum) return null
  const n = caseNum.toUpperCase()
  if (n.startsWith('REZN'))  return 'Rezoning'
  if (n.startsWith('SPLA'))  return 'Site Plan Amendment'
  if (n.startsWith('SPNB'))  return 'Site Plan — New Building'
  if (n.startsWith('SPRC'))  return 'Site Plan Review'
  if (n.startsWith('SP'))    return 'Site Plan'
  if (n.startsWith('UPER'))  return 'Use Permit Extension'
  if (n.startsWith('FBCA'))  return 'Form-Based Code Amendment'
  if (n.startsWith('GLUP'))  return 'General Land Use Plan Amendment'
  if (n.startsWith('Z-'))    return 'Rezoning (legacy)'
  return 'Land Use Case'
}
