import { useTheme } from '../store/theme'

/**
 * 캔버스(Konva)는 CSS 변수를 읽지 못하므로, 테마에 맞는 색을 여기서 직접 정한다.
 * 라이트: 따뜻한 나무 마루 / 다크: 검은 무대(블랙박스).
 */
export interface PlanColors {
  /** 그림으로 저장했을 때 바탕이 비지 않도록 쓰는 배경색 */
  bg: string
  floor: string
  plank: string
  tape: string
  border: string
  label: string
  /** 센터(0번) 표시 색 */
  centerMark: string
}

const LIGHT: PlanColors = {
  bg: '#FFFFFF',
  floor: '#F4E6D0',
  plank: '#E4CDAA',
  tape: '#C0823F',
  border: '#B38A58',
  label: '#5B6272',
  centerMark: '#D32F2F',
}

const DARK: PlanColors = {
  bg: '#161C29',
  floor: '#0B0F17',
  plank: '#1B2232',
  tape: '#56668A',
  border: '#5D6B8C',
  label: '#A9B2C4',
  centerMark: '#FF7A70',
}

export function usePlanColors(): PlanColors {
  return useTheme((s) => s.theme) === 'dark' ? DARK : LIGHT
}
