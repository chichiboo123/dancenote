/**
 * 학생 아이콘 색 팔레트.
 * 앞쪽 8색은 색각이상(색약) 사용자도 구분하기 쉬운 Okabe–Ito 조합을 기준으로 골랐고,
 * 뒤로 갈수록 색상환에서 서로 멀리 떨어지도록 배치했다.
 */
export const PALETTE: { hex: string; label: string }[] = [
  { hex: '#E69F00', label: '주황' },
  { hex: '#0072B2', label: '파랑' },
  { hex: '#009E73', label: '초록' },
  { hex: '#D55E00', label: '주홍' },
  { hex: '#CC79A7', label: '분홍보라' },
  { hex: '#56B4E9', label: '하늘' },
  { hex: '#F0E442', label: '노랑' },
  { hex: '#8C61C2', label: '보라' },
  { hex: '#B2182B', label: '빨강' },
  { hex: '#2E7D32', label: '진초록' },
  { hex: '#7F5539', label: '갈색' },
  { hex: '#4D4D4D', label: '회색' },
  { hex: '#FF8FA3', label: '연분홍' },
  { hex: '#00A5A5', label: '청록' },
  { hex: '#6A8E3F', label: '올리브' },
  { hex: '#1F4E9C', label: '남색' },
  { hex: '#FF5722', label: '다홍' },
  { hex: '#9C27B0', label: '자주' },
  { hex: '#00838F', label: '짙은청록' },
  { hex: '#C2185B', label: '진분홍' },
  { hex: '#7CB342', label: '연두' },
  { hex: '#5D4037', label: '고동' },
  { hex: '#3949AB', label: '인디고' },
  { hex: '#F4A259', label: '살구' },
  { hex: '#00796B', label: '에메랄드' },
  { hex: '#AD1457', label: '와인' },
  { hex: '#546E7A', label: '청회색' },
  { hex: '#EF6C00', label: '호박' },
  { hex: '#8E24AA', label: '진보라' },
  { hex: '#4CAF50', label: '풀색' },
]

/** 아직 쓰지 않은 색을 순서대로 하나 고른다. 다 썼으면 처음부터 다시. */
export function pickColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()))
  const free = PALETTE.find((c) => !used.has(c.hex))
  if (free) return free.hex
  return PALETTE[usedColors.length % PALETTE.length].hex
}

/** #rrggbb → 0~1 상대 휘도 (WCAG 기준) */
function luminance(hex: string): number {
  const v = hex.replace('#', '')
  const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** 두 색의 명암비 (1 ~ 21) */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** 배경색 위에서 더 잘 보이는 글자색(흰색 또는 검정)을 고른다. */
export function textColorOn(bg: string): string {
  const black = '#1A1A1A'
  const white = '#FFFFFF'
  return contrastRatio(bg, black) >= contrastRatio(bg, white) ? black : white
}
