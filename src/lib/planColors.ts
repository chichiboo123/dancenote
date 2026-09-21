import { useTheme } from '../store/theme'

/**
 * 캔버스(Konva)는 CSS 변수를 읽지 못하므로, 테마에 맞는 색을 여기서 직접 정한다.
 * 라이트: 따뜻한 나무 마루 / 다크: 검은 무대(블랙박스).
 */
export interface PlanColors {
  floor: string
  plank: string
  tape: string
  border: string
  label: string
}

const LIGHT: PlanColors = {
  floor: '#F1D9B5',
  plank: '#D8BC90',
  tape: '#B5793F',
  border: '#9C7B4C',
  label: '#55607A',
}

const DARK: PlanColors = {
  floor: '#0E1320',
  plank: '#222B41',
  tape: '#5C6A8C',
  border: '#66739A',
  label: '#AEB8CF',
}

export function usePlanColors(): PlanColors {
  return useTheme((s) => s.theme) === 'dark' ? DARK : LIGHT
}
