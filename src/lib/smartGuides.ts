/**
 * 평면도에서 이름표를 끌 때 쓰는 '맞춤선(Smart Guide)'과 '붙기(Snap)' 계산.
 *
 * 모든 계산은 저장되는 무대 좌표(0~1)로 한다.
 * 반대쪽에서 보기(flipped)는 좌우·앞뒤를 모두 뒤집을 뿐이라 '같은 줄에 있는지'는 바뀌지 않으므로
 * 화면 방향과 상관없이 같은 결과가 나온다.
 * 붙는 거리(문턱)만 화면 픽셀로 정해서 무대 크기와 상관없이 손에 느껴지는 정도가 같게 한다.
 */
import {
  DEPTH_SPACING,
  HALF_STEP,
  MARK_SPACING,
  depthSnapPoints,
  markSnapPoints,
} from './stageMarks'

export interface SnapTarget {
  id: string
  x: number
  y: number
}

/** 세로 맞춤선(같은 x) 한 개 */
export type XGuide =
  | { kind: 'mark'; value: number; targetId: string }
  | { kind: 'center'; value: number }
  | { kind: 'step'; value: number; k: number }

/** 가로 맞춤선(같은 y) 한 개 */
export type YGuide =
  | { kind: 'mark'; value: number; targetId: string }
  | { kind: 'center'; value: number }
  | { kind: 'step'; value: number; k: number }

export interface SnapResult {
  x: number
  y: number
  xGuide?: XGuide
  yGuide?: YGuide
}

export interface SnapOptions {
  /** 무대 바닥의 화면 크기(px). 픽셀 문턱을 무대 좌표로 바꾸는 데 쓴다. */
  floorW: number
  floorH: number
  /** 다른 친구·무대 가운데에 붙는 거리(px) */
  snapPx?: number
}

/** 다른 친구·무대 가운데에 붙는 거리(px). 너무 넓으면 자유롭게 놓기 어렵다. */
export const SNAP_PX = 10

const EPS = 1e-9

/** 가장 가까운 친구 줄 찾기. 같은 거리면 반대 축으로 더 가까운 친구를 고른다. */
function nearestMark(
  value: number,
  other: number,
  targets: SnapTarget[],
  axis: 'x' | 'y',
  threshold: number,
): SnapTarget | undefined {
  const cross = axis === 'x' ? 'y' : 'x'
  let best: { t: SnapTarget; d: number; c: number } | undefined
  for (const t of targets) {
    const d = Math.abs(t[axis] - value)
    if (d > threshold) continue
    const c = Math.abs(t[cross] - other)
    if (!best || d < best.d - EPS || (Math.abs(d - best.d) <= EPS && c < best.c)) {
      best = { t, d, c }
    }
  }
  return best?.t
}

/**
 * 끌고 있는 자리 하나(raw)를 가까운 기준에 붙인다.
 *
 * 우선순위: ① 다른 친구와 같은 줄 ② 무대 가운데(0.5) ③ 무대 앞·옆 번호의 반 칸 자리.
 * 문턱 안에 들어온 것만 붙으므로 멀리 있는 자리로 갑자기 튀지 않는다.
 */
export function snapPoint(raw: { x: number; y: number }, targets: SnapTarget[], opts: SnapOptions): SnapResult {
  const snapPx = opts.snapPx ?? SNAP_PX
  const thrX = opts.floorW > 0 ? snapPx / opts.floorW : 0
  const thrY = opts.floorH > 0 ? snapPx / opts.floorH : 0
  // 번호 자리는 촘촘하므로 조금 더 좁게 붙는다. (반 칸 간격의 30%, 최대 6px)
  const halfStepPx = MARK_SPACING * HALF_STEP * opts.floorW
  const thrStep = opts.floorW > 0 ? Math.min(snapPx * 0.6, halfStepPx * 0.3) / opts.floorW : 0
  const halfDepthPx = DEPTH_SPACING * HALF_STEP * opts.floorH
  const thrStepY = opts.floorH > 0 ? Math.min(snapPx * 0.6, halfDepthPx * 0.3) / opts.floorH : 0

  const result: SnapResult = { x: raw.x, y: raw.y }

  // --- x (세로 맞춤선) ---
  const mx = nearestMark(raw.x, raw.y, targets, 'x', thrX)
  if (mx) {
    result.x = mx.x
    result.xGuide = { kind: 'mark', value: mx.x, targetId: mx.id }
  } else if (Math.abs(raw.x - 0.5) <= thrX) {
    result.x = 0.5
    result.xGuide = { kind: 'center', value: 0.5 }
  } else {
    let best: { x: number; k: number; d: number } | undefined
    for (const p of markSnapPoints()) {
      const d = Math.abs(p.x - raw.x)
      if (d <= thrStep && (!best || d < best.d)) best = { ...p, d }
    }
    if (best) {
      result.x = best.x
      result.xGuide = { kind: 'step', value: best.x, k: best.k }
    }
  }

  // --- y (가로 맞춤선) ---
  const my = nearestMark(raw.y, raw.x, targets, 'y', thrY)
  if (my) {
    result.y = my.y
    result.yGuide = { kind: 'mark', value: my.y, targetId: my.id }
  } else if (Math.abs(raw.y - 0.5) <= thrY) {
    result.y = 0.5
    result.yGuide = { kind: 'center', value: 0.5 }
  } else {
    // 무대 옆 앞뒤 번호의 반 칸 자리
    let best: { y: number; k: number; d: number } | undefined
    for (const p of depthSnapPoints()) {
      const d = Math.abs(p.y - raw.y)
      if (d <= thrStepY && (!best || d < best.d)) best = { ...p, d }
    }
    if (best) {
      result.y = best.y
      result.yGuide = { kind: 'step', value: best.y, k: best.k }
    }
  }

  return result
}

/**
 * 여러 명을 함께 옮길 때, 아무도 무대(0~1) 밖으로 나가지 않는 만큼만 움직인다.
 * 한 명씩 따로 가장자리에 붙이면 간격이 찌그러지므로, 모두에게 같은 dx·dy를 준다.
 */
export function clampGroupDelta(
  points: { x: number; y: number }[],
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  if (points.length === 0) return { dx, dy }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  // 이미 조금 밖에 있던 자리가 있어도 '안쪽으로 끌려 들어가는' 움직임은 만들지 않는다.
  const loX = Math.min(0, -minX)
  const hiX = Math.max(0, 1 - maxX)
  const loY = Math.min(0, -minY)
  const hiY = Math.max(0, 1 - maxY)
  return {
    dx: Math.min(hiX, Math.max(loX, dx)),
    dy: Math.min(hiY, Math.max(loY, dy)),
  }
}

/** 실제 거리(m)를 0.1m 단위로 적는다. (1.46 → "1.5m") */
export function formatMeters(m: number): string {
  return `${(Math.round(m * 10) / 10).toFixed(1)}m`
}
