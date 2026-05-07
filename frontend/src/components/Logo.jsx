export default function Logo({ size = 80, showName = true, className = '' }) {
  const scale = size / 160
  const height = showName ? 192 : 140

  return (
    <svg
      width={size}
      height={Math.round(height * scale)}
      viewBox={`0 0 160 ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="lgbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Hexagon */}
      <polygon
        points="80,16 132,46 132,106 80,136 28,106 28,46"
        fill="url(#lgbg)"
        stroke="url(#lg)"
        strokeWidth="2"
      />

      {/* Location pin — outer shape + inner hole */}
      <path
        fillRule="evenodd"
        fill="url(#lg)"
        d="M80,48 A20,20 0 0,1 98,76 L80,118 L62,76 A20,20 0 0,1 80,48 Z
           M80,60 A8,8 0 1,0 80,76 A8,8 0 1,0 80,60 Z"
      />

      {/* Wordmark */}
      {showName && (
        <text
          x="80"
          y="163"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="20"
          fontWeight="800"
          fill="white"
        >
          ZonePact
        </text>
      )}
    </svg>
  )
}
