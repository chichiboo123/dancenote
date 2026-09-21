/**
 * 무대 앞쪽(객석 쪽) 가장자리에 붙이는 위치 표시.
 *
 * 실제 무대에서 바닥에 테이프로 붙이는 "센터 기준 번호"와 같다.
 *   … 4 3 2 1 0(센터) 1 2 3 4 …
 * 센터에서 좌우로 같은 간격씩 떨어진 자리를 번호로 부르면,
 * "3번으로 가" 처럼 아이들에게 말로 위치를 알려 줄 수 있다.
 */

/** 센터에서 한쪽으로 몇 칸까지 표시할지 */
export const MARK_STEPS = 4

export interface StageMark {
  /** 무대 좌표 0~1 (왼쪽 → 오른쪽) */
  x: number
  /** 화면에 보여 줄 번호 */
  label: string
  /** 센터(0번)인지 */
  center: boolean
}

/** 앞쪽 가장자리 표시 목록 (왼쪽부터 순서대로) */
export function frontStageMarks(): StageMark[] {
  const marks: StageMark[] = []
  for (let k = -MARK_STEPS; k <= MARK_STEPS; k++) {
    marks.push({
      x: 0.5 + (k / MARK_STEPS) * 0.5,
      label: String(Math.abs(k)),
      center: k === 0,
    })
  }
  return marks
}

/** 무대 좌표(0~1)를 가장 가까운 센터 기준 번호로 바꾼다. (예: "센터", "왼 2", "오 3") */
export function describePosition(x: number): string {
  const k = Math.round((x - 0.5) * 2 * MARK_STEPS)
  if (k === 0) return '센터'
  return `${k < 0 ? '왼' : '오'} ${Math.abs(k)}`
}
