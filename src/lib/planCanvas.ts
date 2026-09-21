import { CANVAS_FONT } from './canvasFont'
import type { PlanColors } from './planColors'
import { textColorOn } from './colors'
import { frontStageMarks } from './stageMarks'

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
}

export interface PlanTrail {
  color: string
  points: { x: number; y: number }[]
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
  } = options
  const { x: ox, y: oy, width: w, height: h } = rect
  const r = iconRadius ?? Math.max(12, w / 16)

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

  // 지나온 길
  ctx.setLineDash([9, 7])
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const trail of trails) {
    if (trail.points.length < 2) continue
    ctx.strokeStyle = trail.color
    ctx.globalAlpha = 0.65
    ctx.beginPath()
    trail.points.forEach((p, i) => {
      const v = toView(p.x, p.y)
      if (i === 0) ctx.moveTo(v.x, v.y)
      else ctx.lineTo(v.x, v.y)
    })
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

  // 학생 아이콘
  for (const icon of icons) {
    const v = toView(icon.x, icon.y)
    ctx.beginPath()
    ctx.arc(v.x, v.y, r, 0, Math.PI * 2)
    ctx.fillStyle = icon.color
    ctx.fill()
    ctx.lineWidth = Math.max(2, r * 0.22)
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    ctx.fillStyle = textColorOn(icon.color)
    ctx.font = `700 ${Math.round(r * 0.72)}px ${CANVAS_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon.label, v.x, v.y + r * 0.04)
  }
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
