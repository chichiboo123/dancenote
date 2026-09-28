/**
 * 대화상자가 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게 잠근다.
 *
 * 대화상자마다 "열기 전 값"을 기억했다가 되돌리면, 두 개가 겹쳐 열렸다가 함께 닫힐 때
 * (예: 배우 고치기 → 명단에서 빼기 확인) 닫히는 순서에 따라 'hidden'이 되돌려져
 * 모든 화면의 스크롤이 멈춰 버린다. 그래서 열린 개수를 세어 마지막 하나가 닫힐 때만 푼다.
 */
let openCount = 0

export function lockScroll(): () => void {
  openCount += 1
  document.body.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    openCount = Math.max(0, openCount - 1)
    if (openCount === 0) document.body.style.overflow = ''
  }
}
