import { CANVAS_FONT } from './canvasFont'
import type { PlanColors } from './planColors'
import { textColorOn } from './colors'
import { frontStageMarks, sideStageMarks } from './stageMarks'

/**
 * 무대 평면도를 그냥 캔버스(2D)에 그린다.
 *
 * 화면에서는 Konva로 그리지만, PDF로 뽑을 때는 여러 개를 한 장에 배치해야 해서
 * 같은 그림을 캔버스에 직접 그리는 쪽이 훨씬 간단하다. (그림 모양은 화면과 맞춰 둔다)
 */

export interface PlanIcon {
  x: number
  y: number
  color: string
  label: string
  /** 이모지 모양 이름표 */
  emoji?: string
  /** 0~1 (컷 사이에서 나타나거나 사라지는 중) */
  opacity?: number
  /** 한 배우만 따라갈 때 나머지 배우 */
  faded?: boolean
}

export interface PlanTrail {
  color: string
  points: { x: number; y: number }[]
  faded?: boolean
}

/**
 * 화면(StagePlan)의 이름표 크기를 그대로 옮기기 위한 기준.
 * 화면은 반지름을 `clamp(16, 28, 무대 가로 / 18) × 이름표 크기`로 그린다.
 * 태블릿에서 흔한 무대 가로 640px일 때의 비율을 그림 크기에 맞춰 늘리거나 줄인다.
 */
const SCREEN_FLOOR_W = 640
const SCREEN_ICON_R = Math.max(16, Math.min(28, SCREEN_FLOOR_W / 18))

/** 무대 가로 planW에 그릴 때, 화면과 같은 비율의 이름표 반지름 */
export function screenIconRadius(planW: number, markScale = 1): number {
  return (SCREEN_ICON_R * markScale * planW) / SCREEN_FLOOR_W
}

export interface DrawPlanOptions {
  /** 그릴 자리 (캔버스 좌표) */
  rect: { x: number; y: number; width: number; height: number }
  colors: PlanColors
  icons: PlanIcon[]
  trails?: PlanTrail[]
  showGrid?: boolean
  flipped?: boolean
  /** 아이콘 반지름 */
  iconRadius?: number
  /** 위·아래 라벨을 그릴지 */
  labels?: boolean
  /** 라벨 글자 크기 */
  labelFontSize?: number
  /** 무대 앞쪽 센터 기준 번호 표시 */
  showMarks?: boolean
  /** 이름표 크기 (작게 0.75 · 보통 1 · 크게 1.3). iconRadius를 주지 않았을 때 쓴다. */
  markScale?: number
}

export function drawStagePlan(ctx: CanvasRenderingContext2D, options: DrawPlanOptions) {
  const {
    rect,
    colors,
    icons,
    trails = [],
    showGrid = true,
    flipped = false,
    iconRadius,
    labels = true,
    labelFontSize,
    showMarks = true,
    markScale = 1,
  } = options
  const { x: ox, y: oy, width: w, height: h } = rect
  const r = iconRadius ?? screenIconRadius(w, markScale)
  // 화면 기준(무대 가로 640px)에 견준 배율. 선 굵기를 화면과 같은 비율로 맞춘다.
  const k = Math.max(0.5, w / SCREEN_FLOOR_W)

  const toView = (x: number, y: number) => ({
    x: ox + (flipped ? 1 - x : x) * w,
    y: oy + (flipped ? 1 - y : y) * h,
  })

  // 무대 마루
  roundRect(ctx, ox, oy, w, h, 8)
  ctx.fillStyle = colors.floor
  ctx.fill()

  // 나뭇결
  ctx.strokeStyle = colors.plank
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4
  for (let i = 1; i < 7; i++) {
    const y = oy + (h / 7) * i
    ctx.beginPath()
    ctx.moveTo(ox, y)
    ctx.lineTo(ox + w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 스파이크 테이프 같은 9구역 점선
  if (showGrid) {
    ctx.strokeStyle = colors.tape
    ctx.lineWidth = 2
    ctx.setLineDash([8, 7])
    for (const i of [1, 2]) {
      ctx.beginPath()
      ctx.moveTo(ox + (w / 3) * i, oy)
      ctx.lineTo(ox + (w / 3) * i, oy + h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(ox, oy + (h / 3) * i)
      ctx.lineTo(ox + w, oy + (h / 3) * i)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // 무대 테두리
  roundRect(ctx, ox, oy, w, h, 8)
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 3
  ctx.stroke()

  // 지나온 길 (화면처럼 부드러운 곡선)
  ctx.setLineDash([9 * k, 7 * k])
  ctx.lineWidth = 3 * k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const trail of trails) {
    if (trail.points.length < 2) continue
    ctx.strokeStyle = trail.color
    ctx.globalAlpha = trail.faded ? 0.18 : 0.7
    ctx.beginPath()
    tensionPath(
      ctx,
      trail.points.flatMap((p) => {
        const v = toView(p.x, p.y)
        return [v.x, v.y]
      }),
      0.25,
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([])

  // 무대 앞쪽 센터 기준 번호 (바닥 테이프 표시)
  if (showMarks) {
    const edgeY = flipped ? oy : oy + h
    const dir = flipped ? -1 : 1
    const markFont = Math.round((labelFontSize ?? r * 0.9) * 0.62)
    ctx.textAlign = 'center'
    for (const mark of frontStageMarks()) {
      const vx = ox + (flipped ? 1 - mark.x : mark.x) * w
      const tickLen = mark.center ? h * 0.05 : h * 0.032
      ctx.beginPath()
      ctx.moveTo(vx, edgeY - dir * tickLen)
      ctx.lineTo(vx, edgeY + dir * 3)
      ctx.strokeStyle = mark.center ? colors.centerMark : colors.tape
      ctx.lineWidth = mark.center ? 3.5 : 2
      ctx.lineCap = 'round'
      ctx.stroke()

      ctx.font = `${mark.center ? '700 ' : ''}${markFont}px ${CANVAS_FONT}`
      ctx.fillStyle = mark.center ? colors.centerMark : colors.label
      ctx.textBaseline = flipped ? 'bottom' : 'top'
      ctx.fillText(mark.label, vx, edgeY + dir * (tickLen + 4) * (flipped ? 1 : 0) + (flipped ? -4 : 5))
    }

    // 무대 옆(왼쪽 가장자리) 앞뒤 번호: 무대 앞이 0
    ctx.font = `${markFont}px ${CANVAS_FONT}`
    ctx.fillStyle = colors.label
    ctx.textBaseline = 'middle'
    ctx.textAlign = flipped ? 'left' : 'right'
    for (const mark of sideStageMarks()) {
      const v = toView(0, mark.y)
      const tick = flipped ? -h * 0.03 : h * 0.03
      ctx.beginPath()
      ctx.moveTo(v.x + tick, v.y)
      ctx.lineTo(v.x - (flipped ? -3 : 3), v.y)
      ctx.strokeStyle = colors.tape
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillText(mark.label, v.x + (flipped ? 6 : -6), v.y)
    }
    ctx.textAlign = 'center'
  }

  // 위·아래 라벨
  if (labels) {
    ctx.fillStyle = colors.label
    ctx.font = `700 ${Math.round(labelFontSize ?? r * 0.9)}px ${CANVAS_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(flipped ? '객석' : '무대 뒤', ox + w / 2, oy - 6)
    ctx.textBaseline = 'top'
    ctx.fillText(flipped ? '무대 뒤' : '객석', ox + w / 2, oy + h + (showMarks && !flipped ? 26 : 6))
  }

  // 배우 이름표 — 모양·비율은 화면(StagePlan)과 같게: 흰 테두리 4/28, 글자 0.66배, 아래 그림자
  for (const icon of icons) {
    const alpha = (icon.opacity ?? 1) * (icon.faded ? 0.28 : 1)
    if (alpha <= 0) continue
    const v = toView(icon.x, icon.y)
    const u = r / SCREEN_ICON_R // 화면 이름표(반지름 28)에 견준 배율
    ctx.globalAlpha = alpha

    ctx.beginPath()
    ctx.arc(v.x, v.y + 2 * u, r + 2 * u, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(31,42,68,0.22)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(v.x, v.y, r, 0, Math.PI * 2)
    ctx.fillStyle = icon.color
    ctx.fill()
    ctx.lineWidth = Math.max(1.5, 4 * u)
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (icon.emoji) {
      // 이모지는 동그라미 안에, 짧은 이름은 아래에 작은 띠로
      ctx.font = `${Math.round(r * 1.15)}px ${CANVAS_FONT}`
      ctx.fillText(icon.emoji, v.x, v.y + r * 0.06)
      const fs = Math.max(8, Math.round(r * 0.46))
      ctx.font = `700 ${fs}px ${CANVAS_FONT}`
      const pad = Math.max(1.5, 2 * u)
      const tw = ctx.measureText(icon.label).width + pad * 2
      roundRect(ctx, v.x - tw / 2, v.y + r - 2 * u, tw, fs + pad * 2, 7 * u)
      ctx.fillStyle = icon.color
      ctx.fill()
      ctx.lineWidth = 1.5 * u
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = textColorOn(icon.color)
      ctx.fillText(icon.label, v.x, v.y + r - 2 * u + (fs + pad * 2) / 2)
    } else {
      ctx.fillStyle = textColorOn(icon.color)
      ctx.font = `700 ${Math.round(Math.max(8, r * 0.66))}px ${CANVAS_FONT}`
      ctx.fillText(icon.label, v.x, v.y + r * 0.04)
    }
  }
  ctx.globalAlpha = 1
}

/**
 * 점 여러 개를 화면(Konva Line의 tension)과 같은 방식의 부드러운 곡선으로 잇는다.
 * points는 [x0, y0, x1, y1, ...] 모양이다. 점이 두 개면 곧은 선이다.
 */
function tensionPath(ctx: CanvasRenderingContext2D, points: number[], tension: number) {
  ctx.moveTo(points[0], points[1])
  if (points.length <= 4) {
    ctx.lineTo(points[2], points[3])
    return
  }
  // 가운데 점마다 앞뒤 조절점을 구한다: [c1x, c1y, x, y, c2x, c2y, ...]
  const tp: number[] = []
  for (let n = 2; n < points.length - 2; n += 2) {
    const [x0, y0, x1, y1, x2, y2] = points.slice(n - 2, n + 4)
    const d01 = Math.hypot(x1 - x0, y1 - y0)
    const d12 = Math.hypot(x2 - x1, y2 - y1)
    const fa = (tension * d01) / (d01 + d12)
    const fb = (tension * d12) / (d01 + d12)
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue
    tp.push(x1 - fa * (x2 - x0), y1 - fa * (y2 - y0), x1, y1, x1 + fb * (x2 - x0), y1 + fb * (y2 - y0))
  }
  if (tp.length === 0) {
    for (let n = 2; n < points.length; n += 2) ctx.lineTo(points[n], points[n + 1])
    return
  }
  ctx.quadraticCurveTo(tp[0], tp[1], tp[2], tp[3])
  let n = 4
  while (n < tp.length - 2) {
    ctx.bezierCurveTo(tp[n], tp[n + 1], tp[n + 2], tp[n + 3], tp[n + 4], tp[n + 5])
    n += 6
  }
  const len = points.length
  ctx.quadraticCurveTo(tp[tp.length - 2], tp[tp.length - 1], points[len - 2], points[len - 1])
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
