import { useEffect, useState } from 'react'

/**
 * 캔버스(Konva·PDF)에서 쓰는 글꼴 이름.
 * CSS 변수는 캔버스가 읽지 못하므로 여기에 한 번만 적어 두고 모두 가져다 쓴다.
 */
export const CANVAS_FONT =
  "'Pretendard GOV Variable', 'Pretendard GOV', Pretendard, -apple-system, sans-serif"


let fontsLoaded = false

/**
 * 캔버스는 글꼴이 늦게 도착해도 스스로 다시 그리지 않는다.
 * 글꼴이 준비되면 true로 바뀌므로, 이 값을 key로 써서 글자를 다시 그리게 한다.
 */
export function useCanvasFontReady(): boolean {
  const [ready, setReady] = useState(fontsLoaded)
  useEffect(() => {
    if (fontsLoaded || typeof document === 'undefined' || !document.fonts) return
    let alive = true
    Promise.all([
      document.fonts.load('700 16px "Pretendard GOV Variable"', '가나다라마바사0123456789'),
      document.fonts.load('400 16px "Pretendard GOV Variable"', '무대뒤객석'),
    ])
      .catch(() => undefined)
      .then(() => {
        fontsLoaded = true
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])
  return ready
}
