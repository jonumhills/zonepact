import arlington from '../../../data/petitions.json'
import raleigh   from '../../../data/raleigh_petitions.json'

export const STATUS_META = {
  pending:   { label: 'Pending',   color: '#f59e0b' },
  approved:  { label: 'Approved',  color: '#10b981' },
  denied:    { label: 'Denied',    color: '#ef4444' },
  deferred:  { label: 'Deferred',  color: '#facc15' },
  withdrawn: { label: 'Withdrawn', color: '#9ca3af' },
  unknown:   { label: 'Unknown',   color: '#6b7280' },
}

export function getAllPetitions()     { return arlington.petitions }
export function getRaleighPetitions() { return raleigh.petitions }
export function getMetadata()         { return arlington.metadata }

export function getPetitionsByCounty(county) {
  return county === 'raleigh_nc' ? raleigh.petitions : arlington.petitions
}

export function getPetitionByRpc(rpc) {
  if (!rpc) return null
  return arlington.petitions.find(
    (p) => p.rpc && p.rpc.toLowerCase() === rpc.toLowerCase()
  ) || null
}

export function getPetitionByRpcForCounty(rpc, county) {
  if (!rpc) return null
  const list = county === 'raleigh_nc' ? raleigh.petitions : arlington.petitions
  const field = county === 'raleigh_nc' ? 'pin' : 'rpc'
  return list.find((p) => p[field] && p[field].toLowerCase() === rpc.toLowerCase()) || null
}

export function getPetitionByNumber(num) {
  return (
    arlington.petitions.find((p) => p.petition_number === num) ||
    raleigh.petitions.find((p) => p.petition_number === num) ||
    null
  )
}

export function getActiveRpcs() {
  return arlington.petitions.map((p) => p.rpc).filter(Boolean)
}
