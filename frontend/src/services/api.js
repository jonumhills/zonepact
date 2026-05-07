const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function chatWithAgent(message, conversationHistory = [], txHash = '', county = 'arlington_va') {
  const headers = { 'Content-Type': 'application/json' }
  if (txHash) {
    headers['X-Payment'] = JSON.stringify({ txHash })
  }

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      county_id: county,
      conversation_history: conversationHistory,
    }),
  })

  if (res.status === 402) {
    const err = new Error('Payment required')
    err.status = 402
    const body = await res.json().catch(() => ({}))
    err.paymentRequired = body.payment_required
    throw err
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Server error ${res.status}`)
  }

  return res.json()
}
