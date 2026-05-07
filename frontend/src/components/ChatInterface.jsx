import { useState, useRef, useEffect } from 'react'
import { chatWithAgent } from '../services/api'
import { useWallet } from '../hooks/useWallet'

// ── x402 wallet payment sheet ─────────────────────────────────────────────────

const OPERATOR = import.meta.env.VITE_ZONEPACT_EVM_ADDRESS || ''

function ShortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function PaymentSheet({ pendingMessage, onPaid, onDismiss }) {
  const { account, isCorrectChain, status, error, connect, switchChain, pay } = useWallet()
  const [txError, setTxError] = useState('')

  async function handlePay() {
    setTxError('')
    try {
      const txHash = await pay(OPERATOR)
      await onPaid(txHash)
    } catch (e) {
      setTxError(e.message || 'Transaction failed')
    }
  }

  const isBusy   = status === 'sending' || status === 'confirming' || status === 'connecting'
  const anyError = error || txError

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end"
      style={{ background: 'rgba(13,17,23,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-t-2xl px-5 pt-5 pb-6 flex flex-col gap-3"
        style={{ background: 'rgba(17,22,29,0.99)', border: '1px solid rgba(48,54,61,0.9)',
                 boxShadow: '0 -12px 40px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(88,166,255,0.12)', border: '1px solid rgba(88,166,255,0.2)' }}>
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">x402 Pay-per-Query</p>
              <p className="text-[10px] text-gray-500">0.001 ETH · Base Sepolia</p>
            </div>
          </div>
          <button onClick={onDismiss} disabled={isBusy}
            className="text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors text-xl leading-none w-6 h-6 flex items-center justify-center">×</button>
        </div>

        {/* Query preview */}
        {pendingMessage && (
          <div className="rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.15)' }}>
            <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-0.5">Your query</p>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{pendingMessage}</p>
          </div>
        )}

        {/* Wallet state */}
        {!account ? (
          /* ── Step 1: Connect ── */
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 text-center">Connect your wallet to continue</p>
            <button onClick={connect} disabled={isBusy}
              className="w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ background: 'rgba(88,166,255,0.18)', border: '1px solid rgba(88,166,255,0.35)', color: '#93c5fd' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3h18V6z" />
              </svg>
              {status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        ) : !isCorrectChain ? (
          /* ── Step 2: Switch network ── */
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-[11px] text-amber-400">Switch to Base Sepolia to continue</p>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-gray-600 font-mono">{ShortAddr(account)}</p>
            </div>
            <button onClick={switchChain}
              className="w-full py-3 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
              Switch to Base Sepolia
            </button>
          </div>
        ) : (
          /* ── Step 3: Pay ── */
          <div className="space-y-3">
            {/* Connected badge */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] text-emerald-400 font-mono">{ShortAddr(account)}</p>
              </div>
              <p className="text-[10px] text-gray-600">Base Sepolia</p>
            </div>

            {/* Payment destination */}
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Paying to</p>
              <p className="text-[11px] font-mono text-gray-400 truncate">{OPERATOR || 'operator address not set'}</p>
              <p className="text-[10px] text-gray-600 mt-1">0.001 ETH · chain 84532</p>
            </div>

            {/* Tx status messages */}
            {status === 'sending'    && <TxStatus icon="⏳" text="Waiting for wallet confirmation…" />}
            {status === 'confirming' && <TxStatus icon="⛓" text="Confirming on Base Sepolia…" pulse />}
            {anyError && <p className="text-[11px] text-red-400 text-center">{anyError}</p>}

            <button onClick={handlePay} disabled={isBusy}
              className="w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(88,166,255,0.2)', border: '1px solid rgba(88,166,255,0.4)', color: '#93c5fd' }}>
              {isBusy
                ? <><Spinner /> {status === 'confirming' ? 'Confirming…' : 'Sending…'}</>
                : <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Pay 0.001 ETH &amp; Unlock Query
                  </>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TxStatus({ icon, text, pulse }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.15)' }}>
      <span className={pulse ? 'animate-pulse' : ''}>{icon}</span>
      <p className="text-[11px] text-blue-300">{text}</p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Rich text renderer ────────────────────────────────────────────────────────

const PETITION_NUM_SRC = '(?:SPLA|REZN|SPNB|SPRC|FBCA|GLUP|UPER|SP-)\\d{2}-\\d{4,6}|Z-\\d{1,4}-\\d{2,4}'

function formatInlineText(text, onPetitionClick) {
  const re = new RegExp(
    `(\\*\\*[^*\\n]+?\\*\\*|\\[[^\\]]+?\\]\\([^)]+?\\)|\`[^\`]+?\`|${PETITION_NUM_SRC})`,
    'g'
  )
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[1]
    if (tok.startsWith('**')) {
      parts.push(<strong key={m.index} className="font-semibold text-white">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) {
        parts.push(
          <a key={m.index} href={lm[2]} target="_blank" rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
            {lm[1]}
          </a>
        )
      } else parts.push(tok)
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={m.index} className="text-[11px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#e2e8f0' }}>
          {tok.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(
        <button
          key={m.index}
          onClick={() => onPetitionClick?.(tok)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399' }}
          title={`Show ${tok} on map`}
        >
          <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {tok}
        </button>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

function RichContent({ content, onPetitionClick }) {
  if (!content) return null
  const lines = content.split('\n')
  const result = []
  let bullets = []
  let numbered = []

  function flushLists(key) {
    if (bullets.length) {
      result.push(
        <ul key={`ul-${key}`} className="mt-1 mb-2 space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
              <span className="text-xs text-gray-300 leading-relaxed">{formatInlineText(b, onPetitionClick)}</span>
            </li>
          ))}
        </ul>
      )
      bullets = []
    }
    if (numbered.length) {
      result.push(
        <ol key={`ol-${key}`} className="mt-1 mb-2 space-y-1">
          {numbered.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[10px] font-bold text-blue-400 flex-shrink-0 w-4">{n.num}.</span>
              <span className="text-xs text-gray-300 leading-relaxed">{formatInlineText(n.text, onPetitionClick)}</span>
            </li>
          ))}
        </ol>
      )
      numbered = []
    }
  }

  lines.forEach((line, i) => {
    if (line.trim() === '') { flushLists(i); result.push(<div key={`sp-${i}`} className="h-1" />); return }

    if (/^-{3,}$/.test(line.trim())) {
      flushLists(i)
      result.push(<hr key={`hr-${i}`} className="my-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />)
      return
    }

    const h2 = line.match(/^#{1,2}\s+(.+)$/)
    if (h2) {
      flushLists(i)
      result.push(<p key={i} className="text-xs font-bold text-white mt-3 mb-1">{formatInlineText(h2[1], onPetitionClick)}</p>)
      return
    }

    const h3 = line.match(/^#{3,}\s+(.+)$/)
    if (h3) {
      flushLists(i)
      result.push(<p key={i} className="text-[11px] font-semibold text-blue-300 mt-2 mb-0.5">{formatInlineText(h3[1], onPetitionClick)}</p>)
      return
    }

    const boldHead = line.match(/^\*\*([^*]{3,})\*\*:?\s*$/)
    if (boldHead) { flushLists(i); result.push(<p key={i} className="text-[11px] font-semibold text-blue-300 mt-1.5 mb-0.5">{boldHead[1]}</p>); return }

    const num = line.match(/^(\d+)[.)]\s+(.+)$/)
    if (num) { bullets.length && flushLists(i); numbered.push({ num: num[1], text: num[2] }); return }

    const bul = line.match(/^[-*•]\s+(.+)$/)
    if (bul) {
      numbered.length && flushLists(i)
      const content = bul[1]
      if (content.startsWith('⛓')) {
        flushLists(i)
        result.push(
          <div key={i} className="flex items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
              ⛓ {formatInlineText(content.slice(1).trim(), onPetitionClick)}
            </span>
          </div>
        )
      } else {
        bullets.push(content)
      }
      return
    }

    flushLists(i)
    result.push(
      <p key={i} className="text-xs text-gray-300 leading-relaxed">
        {formatInlineText(line, onPetitionClick)}
      </p>
    )
  })
  flushLists('end')
  return <>{result}</>
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Message({ msg, onPetitionClick }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[88%] px-3 py-2.5 rounded-xl ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        style={
          isUser
            ? { background: 'rgba(88,166,255,0.18)', border: '1px solid rgba(88,166,255,0.2)' }
            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
        }
      >
        {isUser
          ? <p className="text-xs text-white leading-relaxed">{msg.content}</p>
          : <RichContent content={msg.content} onPetitionClick={onPetitionClick} />
        }
        {msg.tools_used?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.tools_used.map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.15)' }}>
                {t}
              </span>
            ))}
          </div>
        )}
        {msg.parcel_count > 0 && (
          <p className="text-[9px] text-emerald-400 mt-1.5">
            ↗ {msg.parcel_count} parcel{msg.parcel_count !== 1 ? 's' : ''} highlighted on map
          </p>
        )}
        {msg.report_url && (
          <a href={msg.report_url} target="_blank" rel="noreferrer"
            className="mt-2 flex items-center gap-1.5 text-[10px] font-medium transition-colors"
            style={{ color: '#34d399' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#6ee7b7'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#34d399'}>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Download verified land record (S3) →
          </a>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="flex gap-1 px-3 py-2 rounded-xl rounded-tl-sm"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
            style={{ animationDelay: `${delay}s`, animationDuration: '0.8s' }} />
        ))}
      </div>
    </div>
  )
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What is going on with 3902 Stratford Ct?',
  'Look up parcel PIN 1705485362',
  'Show me commercial rezoning in Raleigh',
  'Verify petition Z-32-2023 on the blockchain',
]

// ── Main component ────────────────────────────────────────────────────────────

const GATE_DISABLED = import.meta.env.VITE_DISABLE_PAYMENT_GATE === 'true'

export default function ChatInterface({ onParcelsUpdate, county = 'arlington_va', onPetitionClick }) {
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [showGate,    setShowGate]    = useState(false)
  const { account }                   = useWallet()
  const pendingMessageRef = useRef('')
  const currentHashRef    = useRef('')
  const scrollRef         = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function dispatchMessage(userText, hash) {
    setShowGate(false)
    pendingMessageRef.current = ''
    setMessages((prev) => [...prev, { role: 'user', content: userText }])
    setLoading(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const data = await chatWithAgent(userText, history, GATE_DISABLED ? '' : hash, county)
      setMessages((prev) => [...prev, {
        role: 'assistant', content: data.reply,
        tools_used: data.tools_used || [],
        parcel_count: (data.parcel_features || []).length,
        report_url: data.report_url || null,
      }])
      if (data.parcel_features?.length) onParcelsUpdate?.(data.parcel_features)
      currentHashRef.current = ''   // consumed — next query needs a new tx
    } catch (err) {
      currentHashRef.current = ''
      const msg = err.status === 402
        ? 'Payment could not be verified. Please send a new transaction.'
        : `Error: ${err.message || 'Something went wrong.'}`
      setMessages((prev) => [...prev, { role: 'assistant', content: msg, tools_used: [] }])
    } finally {
      setLoading(false)
    }
  }

  async function handlePaid(hash) {
    currentHashRef.current = hash
    if (pendingMessageRef.current) {
      await dispatchMessage(pendingMessageRef.current, hash)
    }
  }

  function sendMessage(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')

    if (GATE_DISABLED) {
      dispatchMessage(userText, '')
      return
    }

    // Gate: stash message, show payment sheet
    pendingMessageRef.current = userText
    setShowGate(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h2 className="text-sm font-bold text-white">Intelligence</h2>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)' }}>
            x402
          </span>
          {GATE_DISABLED && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
              dev
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-gray-500">Claude · Base Sepolia · 0.001 ETH per query</p>
          {account && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          )}
        </div>
      </div>

      {/* Messages — always visible */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[10px] text-gray-600 mb-3">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left text-xs text-gray-400 hover:text-gray-200 px-3 py-2 rounded-lg border border-white/6 hover:border-white/12 transition-colors leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => <Message key={i} msg={m} onPetitionClick={onPetitionClick} />)}
        {loading && <TypingIndicator />}
      </div>

      {/* Input — always visible */}
      <div className="px-4 pb-4 flex-shrink-0 border-t border-white/6 pt-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter address, PIN, or ask about rezoning…"
            rows={2}
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-xl text-xs text-gray-300 placeholder-gray-600 resize-none outline-none focus:ring-1 focus:ring-blue-500/40 leading-relaxed disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30"
            style={{ background: 'rgba(88,166,255,0.2)', border: '1px solid rgba(88,166,255,0.3)' }}
          >
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-gray-700 mt-1.5 text-center">
          {county === 'arlington_va' ? 'Arlington VA' : 'Raleigh NC'} · Base Sepolia
        </p>
      </div>

      {/* x402 bottom-sheet — slides up when payment needed */}
      {showGate && !GATE_DISABLED && (
        <PaymentSheet
          pendingMessage={pendingMessageRef.current}
          onPaid={handlePaid}
          onDismiss={() => { setShowGate(false); pendingMessageRef.current = '' }}
        />
      )}
    </div>
  )
}
