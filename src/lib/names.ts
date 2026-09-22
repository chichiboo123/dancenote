/**
 * 아이콘에 쓸 짧은 이름 만들기.
 * 세 글자 이상인 한국 이름은 성을 빼고 뒤 두 글자를 쓴다. (이송내 → 송내)
 * 이미 쓰고 있는 짧은 이름과 겹치면 글자를 늘려 구분한다.
 */
export function makeShortName(fullName: string, taken: string[] = []): string {
  const name = fullName.trim().replace(/\s+/g, ' ')
  if (!name) return '?'

  const used = new Set(taken)
  const candidates: string[] = []

  const isKoreanName = /^[가-힣]+$/.test(name)
  if (isKoreanName && name.length >= 3) {
    candidates.push(name.slice(1)) // 성을 뺀 이름 (예: 서준, 서준이)
  }
  candidates.push(name.length > 4 ? name.slice(0, 4) : name) // 전체 이름
  candidates.push(name) // 마지막 수단

  for (const c of candidates) {
    if (c && !used.has(c)) return c
  }

  // 그래도 겹치면 뒤에 번호를 붙인다. (서준2, 서준3 …)
  const base = candidates[0] || name
  let n = 2
  while (used.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

/** 여러 줄로 붙여넣은 명단을 이름 목록으로 바꾼다. (줄바꿈·쉼표·탭 모두 인식) */
export function parseNameList(text: string): string[] {
  return text
    .split(/[\n,\t;]+/)
    .map((s) => s.replace(/^[\s.·•\-–—\d)]+/, '').trim())
    .filter((s) => s.length > 0)
}

/**
 * 한국어 조사를 자연스럽게 붙인다. (받침이 있으면 앞말, 없으면 뒷말)
 * 예) josa('이송내', '을', '를') → '를' / josa('장배영', '이', '가') → '이'
 */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  // 한글 음절이 아니면 (숫자·영어 등) 그냥 받침 없는 쪽을 쓴다.
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return withoutBatchim
  return (code - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim
}
