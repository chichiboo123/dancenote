import type { Point } from '../db/types'

/**
 * 사진 위의 무대 네 귀퉁이 ↔ 무대 평면 좌표(0~1)를 서로 바꿔 주는 도구.
 *
 * 귀퉁이 순서는 늘 이렇게 약속한다 (객석에서 볼 때 기준):
 *   ① 무대 뒤 왼쪽 → ② 무대 뒤 오른쪽 → ③ 무대 앞 오른쪽 → ④ 무대 앞 왼쪽
 * 무대 좌표는 x: 0(왼쪽) ~ 1(오른쪽), y: 0(무대 뒤) ~ 1(무대 앞).
 *
 * 네 점을 네 점으로 옮기는 변환(호모그래피)을 직접 계산한다.
 * perspective-transform 패키지는 옛 UMD 방식이라 요즘 번들러에서 깨져서 쓰지 않는다.
 * (OpenCV.js는 이 일만 하기엔 너무 무겁다)
 */

/** 귀퉁이를 누르는 순서와 화면에 보여 줄 이름 */
export const CORNER_LABELS = [
  '무대 뒤 왼쪽',
  '무대 뒤 오른쪽',
  '무대 앞 오른쪽',
  '무대 앞 왼쪽',
] as const

/** 무대 평면의 네 귀퉁이 (위 순서와 짝이 맞는다) */
const STAGE_QUAD: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

/** 8개짜리 연립방정식을 푼다. (부분 피벗을 쓰는 가우스 소거법) */
function solve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length
  const a = matrix.map((row, i) => [...row, rhs[i]])

  for (let col = 0; col < n; col++) {
    // 이 열에서 가장 큰 값을 가진 줄을 위로 올린다. (계산이 안정적으로)
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null // 풀 수 없는 모양
    ;[a[col], a[pivot]] = [a[pivot], a[col]]

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = a[r][col] / a[col][col]
      if (factor === 0) continue
      for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c]
    }
  }

  // 대각선만 남았으므로 바로 나눠 주면 답이 나온다.
  return a.map((row, i) => row[n] / row[i])
}

/** 네 점 → 네 점 변환 계수 [a,b,c,d,e,f,g,h] */
function solveHomography(from: readonly Point[], to: readonly Point[]): number[] | null {
  const m: number[][] = []
  const rhs: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    rhs.push(u)
    m.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    rhs.push(v)
  }
  return solve(m, rhs)
}

function apply(k: number[], p: Point): Point {
  const d = k[6] * p.x + k[7] * p.y + 1
  return {
    x: (k[0] * p.x + k[1] * p.y + k[2]) / d,
    y: (k[3] * p.x + k[4] * p.y + k[5]) / d,
  }
}

export interface StageMapper {
  /** 사진 좌표 → 무대 좌표(0~1) */
  toStage(p: Point): Point
  /** 무대 좌표(0~1) → 사진 좌표 */
  toImage(p: Point): Point
}

/** 네 귀퉁이로 변환기를 만든다. 점이 이상하면 null을 돌려준다. */
export function createStageMapper(corners: readonly Point[]): StageMapper | null {
  const forward = solveHomography(corners, STAGE_QUAD)
  const backward = solveHomography(STAGE_QUAD, corners)
  if (!forward || !backward) return null
  return {
    toStage: (p) => apply(forward, p),
    toImage: (p) => apply(backward, p),
  }
}

/** 0~1 밖으로 나간 좌표를 무대 가장자리에 붙인다. */
export function clampToStage(p: Point): Point {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  }
}

/** 네 점이 제대로 된 사각형인지(뒤집히거나 찌그러지지 않았는지) 확인한다. */
export function isValidQuad(corners: readonly Point[]): boolean {
  if (corners.length !== 4) return false
  if (corners.some((c) => !Number.isFinite(c.x) || !Number.isFinite(c.y))) return false

  // 네 변을 돌면서 꺾이는 방향이 한쪽으로만 일정해야 볼록한 사각형이다.
  let positive = 0
  let negative = 0
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    const c = corners[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross > 0) positive++
    if (cross < 0) negative++
  }
  if (positive !== 4 && negative !== 4) return false

  // 너무 납작하면(면적이 거의 0) 변환이 망가진다.
  const area = Math.abs(
    corners.reduce((sum, p, i) => {
      const q = corners[(i + 1) % 4]
      return sum + (p.x * q.y - q.x * p.y)
    }, 0) / 2,
  )
  return area > 100
}
