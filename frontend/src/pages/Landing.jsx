import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

const REGISTRY = '0x82b5Bb6A1F76484C28b87d59c984656DA9aD04Bc'
const BASESCAN  = `https://sepolia.basescan.org/address/${REGISTRY}`

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080c12] text-white overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4"
        style={{ background: 'rgba(8,12,18,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Logo size={28} showName={false} />
          <span className="font-bold text-white tracking-tight">ZonePact</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/map')}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5">
            Map
          </button>
          <button onClick={() => navigate('/intel')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(88,166,255,0.15)', border: '1px solid rgba(88,166,255,0.3)', color: '#93c5fd' }}>
            Intelligence →
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(88,166,255,0.07) 0%, transparent 70%)' }} />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/25 mb-8"
          style={{ background: 'rgba(16,185,129,0.06)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">426 rezoning petitions verified on Base Sepolia</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6 max-w-3xl mx-auto">
          Land verification{' '}
          <span style={{ background: 'linear-gradient(135deg, #58a6ff 0%, #38bdf8 50%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            without the $5k consultant
          </span>
        </h1>

        <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
          Ask an AI about any parcel or address. Get the full rezoning history,
          instantly verified against an immutable on-chain registry on Base Sepolia.
          Pay per query with x402.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <button onClick={() => navigate('/intel')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', boxShadow: '0 0 24px rgba(37,99,235,0.35)' }}>
            Try Intelligence →
          </button>
          <button onClick={() => navigate('/map')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-white/6"
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
            Explore the Map
          </button>
        </div>

        {/* Mock chat preview */}
        <div className="max-w-xl mx-auto rounded-2xl overflow-hidden text-left"
          style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(48,54,61,0.8)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-[11px] text-gray-600 ml-2">ZonePact Intelligence</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)' }}>x402</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* user message */}
            <div className="flex justify-end">
              <div className="text-xs px-3 py-2 rounded-xl rounded-tr-sm max-w-[75%]"
                style={{ background: 'rgba(88,166,255,0.18)', border: '1px solid rgba(88,166,255,0.2)' }}>
                What's happening with 3902 Stratford Ct?
              </div>
            </div>
            {/* AI response */}
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="text-xs px-3 py-2.5 rounded-xl rounded-tl-sm flex-1 space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="font-bold text-white text-[11px]">3902 STRATFORD CT, Raleigh NC</p>
                <p className="text-gray-400 text-[10px]"><span className="text-gray-500">PIN</span> 1705485362 · <span className="text-gray-500">Owner</span> STABLER, MATTHEW H</p>
                <div className="h-px bg-white/6 my-1" />
                <p className="text-[10px] font-semibold text-blue-300">Active Petition: Z-32-2023</p>
                <p className="text-[10px] text-gray-400">Zoning change: <span className="text-blue-300">R-4 → Residential-4</span></p>
                <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full mt-1"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                  ⛓ Verified on Base Sepolia · May 7 2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <section className="border-y border-white/6 py-10"
        style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: '426',   label: 'Petitions on-chain',   sub: 'Base Sepolia'       },
            { n: '434k',  label: 'Wake Co. parcels',     sub: 'Raleigh NC'          },
            { n: '~25k',  label: 'Arlington parcels',    sub: 'Arlington VA'        },
            { n: '$0.001',label: 'Per query',             sub: 'x402 · ETH'         },
          ].map(({ n, label, sub }) => (
            <div key={label}>
              <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">{n}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem / Solution ───────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Before */}
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] text-red-400 uppercase tracking-widest font-medium mb-4">Before ZonePact</p>
            <div className="space-y-3">
              {[
                ['$5,000–$8,000', 'per land verification engagement'],
                ['2–4 weeks',     'waiting for consultant report'],
                ['No audit trail', 'easy to tamper or misrepresent'],
                ['Manual FOIA',   'public records requests by hand'],
              ].map(([bold, rest]) => (
                <div key={bold} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-red-500/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-xs text-gray-400"><span className="text-white font-medium">{bold}</span> {rest}</p>
                </div>
              ))}
            </div>
          </div>

          {/* After */}
          <div className="rounded-2xl p-6"
            style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-medium mb-4">With ZonePact</p>
            <div className="space-y-3">
              {[
                ['$0.001 ETH',    'per query via x402 micropayment'],
                ['Instant',       'AI answers in seconds'],
                ['On-chain proof', 'immutable registry on Base Sepolia'],
                ['Natural language','just ask — no FOIA, no waiting'],
              ].map(([bold, rest]) => (
                <div key={bold} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <p className="text-xs text-gray-400"><span className="text-white font-medium">{bold}</span> {rest}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="border-t border-white/6 py-20"
        style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-white mb-12">Three steps to verified land intelligence</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                color: '#58a6ff',
                bg: 'rgba(88,166,255,0.08)',
                border: 'rgba(88,166,255,0.2)',
                title: 'Ask the AI',
                body: 'Type any address, parcel PIN, or natural language question. The Claude agent understands intent — no specific syntax required.',
                example: '"What\'s happening with 3902 Stratford Ct?"',
              },
              {
                step: '02',
                color: '#f59e0b',
                bg: 'rgba(245,158,11,0.08)',
                border: 'rgba(245,158,11,0.2)',
                title: 'Pay per query',
                body: 'Connect your wallet. One click sends 0.001 ETH on Base Sepolia via x402. No subscriptions. No API keys. Pay only when you ask.',
                example: 'MetaMask · Coinbase Wallet · any injected provider',
              },
              {
                step: '03',
                color: '#34d399',
                bg: 'rgba(52,211,153,0.08)',
                border: 'rgba(52,211,153,0.2)',
                title: 'Get proof',
                body: 'Receive full parcel details, rezoning history, and ⛓ blockchain verification from ZonePactRegistry. The parcel polygon highlights live on the map.',
                example: 'Contract: 0x82b5…04Bc on Base Sepolia',
              },
            ].map(({ step, color, bg, border, title, body, example }) => (
              <div key={step} className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tabular-nums" style={{ color, opacity: 0.4 }}>{step}</span>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed flex-1">{body}</p>
                <p className="text-[10px] font-mono rounded-lg px-2.5 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.3)', color, border: `1px solid ${border}` }}>
                  {example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────── */}
      <section className="border-t border-white/6 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-2">Built with</p>
          <h2 className="text-2xl font-bold text-white mb-10">Full-stack AI × Web3 infrastructure</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                name: 'Claude on AWS Bedrock',
                desc: 'Agentic reasoning with tool use — lookup_parcel, get_onchain_history, filter_by_zoning',
                color: '#f97316',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                ),
              },
              {
                name: 'Base Sepolia',
                desc: 'ZonePactRegistry.sol stores 426 petitions on-chain. Cryptographic proof replacing consultant verification.',
                color: '#3b82f6',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ),
              },
              {
                name: 'x402 Protocol',
                desc: 'HTTP 402 micropayment gate — 0.001 ETH per AI query. Wallet signing via window.ethereum.',
                color: '#a78bfa',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                name: 'Supabase + Mapbox',
                desc: '434k parcel polygons from Wake County ArcGIS. Vector tilesets for real-time map rendering.',
                color: '#34d399',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                ),
              },
            ].map(({ name, desc, color, icon }) => (
              <div key={name} className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white mb-1">{name}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AWS Architecture ─────────────────────────────────────── */}
      <section className="border-t border-white/6 py-20"
        style={{ background: 'rgba(249,115,22,0.02)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <svg className="w-4 h-4" style={{ color: '#f97316' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
            </div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">AWS Integration</p>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Three AWS services. One query.</h2>
          <p className="text-sm text-gray-500 mb-10 max-w-xl">
            Every AI query touches Amazon Bedrock for inference, S3 for tamper-proof report storage, and SNS for landowner alerts.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              {
                service: 'Amazon Bedrock',
                label:   'AI Inference',
                color:   '#f97316',
                desc:    'Claude runs on Bedrock in production. Agentic tool-use loop (lookup_parcel → get_onchain_history) with multi-step reasoning.',
                detail:  'Model: anthropic.claude-opus-4-5',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                ),
              },
              {
                service: 'Amazon S3',
                label:   'Report Storage',
                color:   '#f59e0b',
                desc:    'After each verified parcel lookup, a structured JSON report (owner + zoning + blockchain proof) is uploaded to S3.',
                detail:  'Bucket: zonepact-reports · 7-day presigned URLs',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                ),
              },
              {
                service: 'Amazon SNS',
                label:   'Parcel Alerts',
                color:   '#a78bfa',
                desc:    'Landowners subscribe to parcel PIN alerts. When a new rezoning petition is detected, SNS fires a targeted email within minutes.',
                detail:  'Filter policy: pin — targeted per-parcel delivery',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                ),
              },
            ].map(({ service, label, color, desc, detail, icon }) => (
              <div key={service} className="rounded-xl p-5 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${color}22` }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
                    {icon}
                  </div>
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                    {label}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white mb-1">{service}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{desc}</p>
                  <p className="text-[10px] font-mono" style={{ color: `${color}99` }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Architecture flow */}
          <div className="rounded-xl px-5 py-4 flex flex-wrap items-center justify-center gap-2 text-[11px]"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'User query',    color: '#6b7280' },
              { label: '→' },
              { label: 'x402 payment', color: '#a78bfa' },
              { label: '→' },
              { label: 'Bedrock / Claude', color: '#f97316' },
              { label: '→' },
              { label: 'Supabase + Base Sepolia', color: '#3b82f6' },
              { label: '→' },
              { label: 'S3 report',    color: '#f59e0b' },
              { label: '+' },
              { label: 'SNS alert',    color: '#a78bfa' },
            ].map((item, i) => (
              item.label === '→' || item.label === '+'
                ? <span key={i} className="text-gray-700">{item.label}</span>
                : <span key={i} className="px-2.5 py-1 rounded-full font-medium"
                    style={{ background: `${item.color}12`, color: item.color, border: `1px solid ${item.color}25` }}>
                    {item.label}
                  </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contract ─────────────────────────────────────────────── */}
      <section className="border-t border-white/6 py-16"
        style={{ background: 'rgba(16,185,129,0.025)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl p-6 md:p-8"
            style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider">Live on Base Sepolia</p>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">ZonePactRegistry.sol</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  An immutable on-chain registry storing every rezoning petition. Anyone can
                  verify land history without trusting ZonePact — just query the contract directly.
                </p>
                <div className="mt-4 font-mono text-xs text-emerald-400 break-all">{REGISTRY}</div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <div className="rounded-xl px-4 py-3 text-center min-w-[130px]"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-2xl font-bold text-white">426</p>
                  <p className="text-[10px] text-emerald-400">Petitions stored</p>
                </div>
                <a href={BASESCAN} target="_blank" rel="noreferrer"
                  className="text-center text-[11px] py-2 px-4 rounded-xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                  View on BaseScan ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────────────── */}
      <section className="border-t border-white/6 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-2">Who it's for</p>
          <h2 className="text-2xl font-bold text-white mb-10">DeFi and real estate, finally talking</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'DeFi Lenders',
                sub: 'Aave, Centrifuge, Maple',
                body: 'Verify land collateral before originating RWA loans. Get blockchain-stamped proof in seconds instead of paying $5-8k per verification.',
                color: '#818cf8',
              },
              {
                title: 'Real Estate Investors',
                sub: 'Developers, flippers, REITs',
                body: 'Monitor rezoning petitions near your portfolio. Get instant alerts when a parcel you\'re watching enters the rezoning pipeline.',
                color: '#38bdf8',
              },
              {
                title: 'Urban Planners',
                sub: 'City staff, consultants',
                body: 'Query historical zoning changes across thousands of parcels. Ask natural language questions about density trends and land use shifts.',
                color: '#34d399',
              },
            ].map(({ title, sub, body, color }) => (
              <div key={title} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[11px] font-mono mb-1" style={{ color }}>{sub}</p>
                <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-white/6 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(37,99,235,0.08) 0%, transparent 70%)' }} />
        <div className="relative max-w-lg mx-auto px-6">
          <h2 className="text-3xl font-bold text-white mb-4">Start querying in 30 seconds</h2>
          <p className="text-sm text-gray-400 mb-8 leading-relaxed">
            Connect your wallet, ask about any parcel or address, and get AI-powered
            rezoning intelligence with blockchain proof. 0.001 ETH per query.
          </p>
          <button onClick={() => navigate('/intel')}
            className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', boxShadow: '0 0 32px rgba(37,99,235,0.4)' }}>
            Open Intelligence →
          </button>
          <p className="text-[11px] text-gray-600 mt-4">No account. No subscription. Just a Web3 wallet.</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">ZonePact</span>
            <span className="text-gray-700 text-xs">· Coinbase × AWS Agentic Hackathon 2025</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-600">
            <span>Claude · Base Sepolia · AWS Bedrock · x402</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
