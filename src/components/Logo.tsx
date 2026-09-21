/** 동선노트 로고 — 점선 화살표로 이어진 작은 원 두 개 */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 46 C 28 46, 34 24, 44 21"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
        <path
          d="M39 17 L46 20.5 L40 25"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="46" r="9" fill="#FF6B4A" stroke="#fff" strokeWidth="3" />
        <circle cx="47" cy="21" r="9" fill="#3CC7A8" stroke="#fff" strokeWidth="3" />
      </svg>
      <span className="logo-text">동선노트</span>
    </span>
  )
}
