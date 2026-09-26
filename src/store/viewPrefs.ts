import { create } from 'zustand'

/** 재생 속도 */
export type PlaySpeed = 'slow' | 'normal' | 'fast'

/** 컷 하나가 다음 컷으로 옮겨 가는 데 걸리는 시간(초) */
export const SPEED_SECONDS: Record<PlaySpeed, number> = {
  slow: 2.6,
  normal: 1.6,
  fast: 0.9,
}

export const SPEED_LABELS: Record<PlaySpeed, string> = {
  slow: '느리게',
  normal: '보통',
  fast: '빠르게',
}

/** 평면도 이름표 크기 */
export type MarkSize = 'small' | 'normal' | 'large'

export const MARK_SIZE_SCALE: Record<MarkSize, number> = {
  small: 0.75,
  normal: 1,
  large: 1.3,
}

export const MARK_SIZE_LABELS: Record<MarkSize, string> = {
  small: '작게',
  normal: '보통',
  large: '크게',
}

interface ViewPrefs {
  /** 무대 9구역 점선 보기 */
  showGrid: boolean
  /**
   * 무대를 반대쪽에서 보기.
   * 끄면 객석에서 본 모습(아래가 객석), 켜면 무대 위에서 객석을 바라본 모습(아래가 무대 뒤).
   */
  flipped: boolean
  /** 지나온 길(궤적) 보기 */
  showTrails: boolean
  /** 이전 컷 자리 보기 */
  showGhosts: boolean
  speed: PlaySpeed
  /** 이름표 크기 */
  markSize: MarkSize
  set: (patch: Partial<Omit<ViewPrefs, 'set'>>) => void
}

const STORAGE_KEY = 'dongseon-view-prefs'

function load(): Partial<ViewPrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    // 저장소를 못 쓰는 환경에서는 기본값으로 시작한다.
    return {}
  }
}

export const useViewPrefs = create<ViewPrefs>((set, get) => ({
  showGrid: true,
  flipped: false,
  showTrails: true,
  showGhosts: true,
  speed: 'normal',
  markSize: 'normal',
  ...load(),
  set: (patch) => {
    set(patch)
    try {
      const { showGrid, flipped, showTrails, showGhosts, speed, markSize } = get()
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ showGrid, flipped, showTrails, showGhosts, speed, markSize }),
      )
    } catch {
      // 저장이 안 돼도 이번 사용 중에는 그대로 적용된다.
    }
  },
}))
