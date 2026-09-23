/** 동선노트 로고 — 무대 위에서 점선으로 이어진 두 이름표 */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1C7BE8" />
            <stop offset="1" stopColor="#6A5BFF" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#logo-bg)" />
        <path
          d="M19 44 C 29 44, 34 26, 44 21"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 6"
        />
        <circle cx="19" cy="44" r="8" fill="#FFD6E0" stroke="#fff" strokeWidth="3" />
        <circle cx="45" cy="20" r="8" fill="#FFF3B0" stroke="#fff" strokeWidth="3" />
      </svg>
      <span className="logo-text">동선노트</span>
    </span>
  )
}
