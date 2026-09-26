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

/**
 * 센터에서 k칸 떨어진 자리의 무대 좌표(0~1).
 * k는 왼쪽이 음수, 오른쪽이 양수이며 0.5처럼 반 칸도 된다.
 * 화면에 그리는 번호와 끌어 놓을 때 붙는 자리가 모두 이 식을 쓰므로 서로 어긋나지 않는다.
 */
export function markX(k: number): number {
  return 0.5 + (k / MARK_STEPS) * 0.5
}

/** 앞쪽 가장자리 표시 목록 (왼쪽부터 순서대로) */
export function frontStageMarks(): StageMark[] {
  const marks: StageMark[] = []
  for (let k = -MARK_STEPS; k <= MARK_STEPS; k++) {
    marks.push({
      x: markX(k),
      label: String(Math.abs(k)),
      center: k === 0,
    })
  }
  return marks
}

/** 번호 사이 반 칸 단위 */
export const HALF_STEP = 0.5

/**
 * 이름표를 끌 때 붙는 자리 (화면에는 번호만 보이고 반 칸 자리는 숨어 있다).
 * 왼 4, 왼 3.5, … 센터 … 오 3.5, 오 4 처럼 반 칸 간격이다.
 */
export function markSnapPoints(): { x: number; k: number }[] {
  const points: { x: number; k: number }[] = []
  const count = MARK_STEPS / HALF_STEP
  for (let i = -count; i <= count; i++) {
    const k = i * HALF_STEP
    points.push({ x: markX(k), k })
  }
  return points
}

/** 번호 한 칸이 무대 가로에서 차지하는 비율(0~1) */
export const MARK_SPACING = markX(1) - markX(0)

/** 반 칸 단위 번호를 말로 바꾼다. (예: "센터", "왼 2.5", "오 3") */
export function describeMarkStep(k: number): string {
  if (Math.abs(k) < 1e-9) return '센터'
  return `${k < 0 ? '왼' : '오'} ${Math.abs(k)}`
}

/** 무대 좌표(0~1)를 가장 가까운 센터 기준 번호로 바꾼다. (예: "센터", "왼 2", "오 3") */
export function describePosition(x: number): string {
  const k = Math.round((x - 0.5) * 2 * MARK_STEPS)
  if (k === 0) return '센터'
  return `${k < 0 ? '왼' : '오'} ${Math.abs(k)}`
}
