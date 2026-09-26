import { CANVAS_FONT, useCanvasFontReady } from '../lib/canvasFont'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useElementSize } from '../lib/useElementSize'
import { textColorOn } from '../lib/colors'
import { usePlanColors } from '../lib/planColors'
import { describeMarkStep, describePosition, frontStageMarks } from '../lib/stageMarks'
import {
  clampGroupDelta,
  formatMeters,
  snapPoint,
  type SnapResult,
  type XGuide,
  type YGuide,
} from '../lib/smartGuides'

export interface Mark {
  id: string
  /** 무대 좌표 0~1 */
  x: number
  y: number
  color: string
  /** 아이콘 안에 쓰는 짧은 이름 */
  label: string
  /** 흐리게 보일지 (다른 학생 따라가기 등) */
  faded?: boolean
  /** 0~1. 컷 사이에서 나타나거나 사라질 때 쓴다. */
  opacity?: number
}

/** 이름표를 눌렀을 때 함께 넘겨 주는 정보 */
export interface SelectOptions {
  /** Ctrl(⌘)을 누른 채 눌렀는지. 켜져 있으면 고른 목록에 넣거나 빼는(토글) 뜻이다. */
  additive: boolean
}

/** 여러 명을 한꺼번에 옮길 때 넘겨 주는 새 자리 (무대 좌표 0~1) */
export interface MarkMove {
  id: string
  x: number
  y: number
}

/** 한 사람이 지나온 길 */
export interface Trail {
  id: string
  color: string
  /** 무대 좌표 0~1 점들 */
  points: { x: number; y: number }[]
  faded?: boolean
}

interface Props {
  stageWidthM: number
  stageDepthM: number
  marks: Mark[]
  /** 이전 컷 위치 (흐린 아이콘 + 점선 화살표) */
  ghosts?: Mark[]
  showGrid?: boolean
  /**
   * 무대를 반대쪽에서 보기.
   * 끄면 객석에서 본 모습(아래가 객석), 켜면 무대 위에서 객석을 바라본 모습(아래가 무대 뒤).
   */
  flipped?: boolean
  /** 지나온 길(점선) */
  trails?: Trail[]
  /** 무대 앞쪽 센터 기준 번호(4 3 2 1 0 1 2 3 4) 표시 */
  showMarks?: boolean
  /** 아이콘을 끌어 옮겼을 때 (무대 좌표 0~1). onMoveMarks가 있으면 그쪽을 쓴다. */
  onMoveMark?: (id: string, x: number, y: number) => void
  /**
   * 아이콘을 끌어 옮겼을 때, 함께 움직인 모든 사람의 새 자리.
   * selectedIds와 함께 쓰면 고른 사람들이 한꺼번에 움직인다. (맞춤선·붙기는 끌 수 있으면 늘 켜진다)
   */
  onMoveMarks?: (moves: MarkMove[]) => void
  /** 끌기를 막 시작했을 때. 함께 움직일 사람들의 id를 넘겨 준다. (되돌리기 기록, 선택 바꾸기에 쓴다) */
  onMoveStart?: (ids: string[]) => void
  /** 지금 골라 둔 아이콘들. 바깥 테두리로 표시하고, 하나를 끌면 모두 함께 움직인다. */
  selectedIds?: string[]
  /** 켜면 Ctrl 없이 눌러도 고른 목록에 넣거나 뺀다. (태블릿처럼 키보드가 없을 때) */
  multiSelect?: boolean
  /** 빈 곳을 길게 눌렀을 때 */
  onLongPressEmpty?: (x: number, y: number) => void
  /** 아이콘을 눌렀을 때. 두 번째 값은 필요한 곳에서만 쓰면 된다. */
  onSelectMark?: (id: string, options?: SelectOptions) => void
  /** 빈 곳을 한 번 눌렀을 때 (직접 넣기 모드에서 쓴다) */
  onTapEmpty?: (x: number, y: number) => void
  /** 그림 파일로 저장할 때 쓰려고 캔버스를 밖으로 넘겨 준다. */
  stageRef?: React.RefObject<Konva.Stage | null>
  /** 평면도 최대 높이(px). 없으면 화면 높이의 62%. */
  maxHeight?: number
}

/** 평면도가 화면 높이를 넘지 않게 하는 최대 높이 */
function useMaxPlanHeight(fixed?: number) {
  const [h, setH] = useState(() =>
    typeof window === 'undefined' ? 600 : Math.max(300, window.innerHeight * 0.62),
  )
  useEffect(() => {
    const update = () => setH(Math.max(300, window.innerHeight * 0.62))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return fixed ?? h
}

const PAD = 34 // 라벨이 들어갈 바깥 여백
const BOTTOM_EXTRA = 18 // 앞쪽 번호가 들어갈 자리

/** Ctrl(윈도우) / ⌘(맥) / Shift를 누른 채 눌렀는지 */
function isAdditive(evt: Event | undefined): boolean {
  if (!evt) return false
  const e = evt as MouseEvent
  return Boolean(e.ctrlKey || e.metaKey || e.shiftKey)
}

const PILL_FONT = 12
const PILL_PAD = 4
let measureCtx: CanvasRenderingContext2D | null = null

/** 알약 글자의 너비(px). 가운데 맞추기에 쓴다. */
function pillWidth(text: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * PILL_FONT + PILL_PAD * 2
  measureCtx.font = `bold ${PILL_FONT}px ${CANVAS_FONT}`
  return measureCtx.measureText(text).width + PILL_PAD * 2
}

/** 끄는 동안 기억해 두는 것 (저장하지 않는 화면 상태) */
interface DragState {
  /** 손으로 잡고 있는 사람 (맞춤선의 기준) */
  anchorId: string
  /** 함께 움직이는 사람들 */
  ids: string[]
  /** 끌기 시작할 때의 실제 자리 (화면에서 벌려 보인 자리가 아니라 저장된 자리) */
  orig: Record<string, { x: number; y: number }>
  /** 끌기 시작할 때 손가락(마우스) 위치 (화면 px) */
  pointer: { x: number; y: number }
}

/** 지금 화면에 보여 줄 맞춤선 */
interface ActiveGuides {
  /** 손으로 잡은 사람의 실제 자리 */
  anchor: { x: number; y: number }
  xGuide?: XGuide
  yGuide?: YGuide
}

/** 위에서 내려다본 무대 평면도. 아래쪽이 객석, 위쪽이 무대 뒤. */
export default function StagePlan({
  stageWidthM,
  stageDepthM,
  marks,
  ghosts = [],
  showGrid = false,
  flipped = false,
  trails = [],
  showMarks = true,
  onMoveMark,
  onMoveMarks,
  onMoveStart,
  selectedIds,
  multiSelect = false,
  onLongPressEmpty,
  onSelectMark,
  onTapEmpty,
  stageRef,
  maxHeight,
}: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const colors = usePlanColors()
  const fontReady = useCanvasFontReady()
  const longPressTimer = useRef<number | null>(null)
  // 길게 누르기가 이미 처리됐으면, 손을 뗄 때 '한 번 누르기'로 또 처리하지 않는다.
  const longPressFired = useRef(false)
  // 이번 누르기에서 이름표를 끌었는지 (끈 뒤 손을 뗀 곳이 빈 바닥이어도 '빈 곳 누르기'로 보지 않는다)
  const draggedRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  // 이름표를 누른 순간의 손 위치. Konva는 조금 움직인 뒤에야 끌기를 시작하므로, 그 첫 움직임도 놓치지 않게 한다.
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  // 끌고 있는 사람들은 화면에서 벌려 보이지 않고 실제 자리에 그린다. (맞춤선이 정확히 지나가도록)
  const [dragIds, setDragIds] = useState<string[] | null>(null)
  const [guides, setGuides] = useState<ActiveGuides | null>(null)
  const canDrag = Boolean(onMoveMark || onMoveMarks)
  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds])

  const maxViewH = useMaxPlanHeight(maxHeight)
  const ratio = stageDepthM / stageWidthM
  // 칸 너비에 맞추되, 화면 높이를 넘지 않도록 줄인다. (재생 버튼이 화면 밖으로 밀리지 않게)
  const floorW = Math.max(
    0,
    Math.min(width - PAD * 2, (maxViewH - PAD * 2 - BOTTOM_EXTRA) / ratio),
  )
  const floorH = floorW * ratio
  const viewH = floorH + PAD * 2 + BOTTOM_EXTRA
  // 가로로 남는 자리는 양쪽에 똑같이 나눠 가운데에 둔다.
  const PX = Math.max(PAD, (width - floorW) / 2)

  /**
   * 무대 좌표(0~1) → 화면 좌표.
   * 반대쪽에서 볼 때는 무대를 180도 돌려 본 것과 같으므로 좌우·앞뒤가 모두 뒤집힌다.
   */
  const toView = useMemo(
    () => (x: number, y: number) => ({
      x: PX + (flipped ? 1 - x : x) * floorW,
      y: PAD + (flipped ? 1 - y : y) * floorH,
    }),
    [floorW, floorH, flipped, PX],
  )

  /** 화면 좌표 → 무대 좌표(0~1) */
  function toStage(px: number, py: number) {
    const vx = Math.min(1, Math.max(0, (px - PX) / floorW))
    const vy = Math.min(1, Math.max(0, (py - PAD) / floorH))
    return { x: flipped ? 1 - vx : vx, y: flipped ? 1 - vy : vy }
  }

  // 나뭇결 무늬 (마루판 느낌)
  const planks = useMemo(() => {
    const lines: number[] = []
    const count = 7
    for (let i = 1; i < count; i++) lines.push((floorH / count) * i)
    return lines
  }, [floorH])

  const iconR = Math.max(16, Math.min(28, floorW / 18))

  /**
   * 이름표가 거의 같은 자리에 겹치면 글자를 읽을 수 없으므로, 화면에서만 살짝 벌려 보여 준다.
   * (저장된 자리는 그대로다. 끌어서 옮기면 손가락이 있는 곳으로 정확히 간다)
   */
  const viewPos = useMemo(() => {
    const pts = marks.map((m) => toView(m.x, m.y))
    const minGap = iconR * 1.7
    const pinned = new Set(dragIds ?? [])
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < pts.length; i++) {
        if (pinned.has(marks[i].id)) continue
        for (let j = i + 1; j < pts.length; j++) {
          if (pinned.has(marks[j].id)) continue
          let dx = pts[j].x - pts[i].x
          let dy = pts[j].y - pts[i].y
          let d = Math.hypot(dx, dy)
          if (d >= minGap) continue
          if (d < 0.01) {
            dx = 1
            dy = 0
            d = 1
          }
          const push = (minGap - d) / 2
          pts[i] = { x: pts[i].x - (dx / d) * push, y: pts[i].y - (dy / d) * push }
          pts[j] = { x: pts[j].x + (dx / d) * push, y: pts[j].y + (dy / d) * push }
        }
      }
    }
    const map: Record<string, { x: number; y: number }> = {}
    marks.forEach((m, i) => (map[m.id] = pts[i]))
    return map
  }, [marks, toView, iconR, dragIds])

  function emitMoves(moves: { id: string; x: number; y: number }[]) {
    if (onMoveMarks) onMoveMarks(moves)
    else for (const mv of moves) onMoveMark?.(mv.id, mv.x, mv.y)
  }

  /** 끌기 시작: 함께 움직일 사람과 처음 자리를 기억한다. */
  function handleDragStart(m: Mark, e: Konva.KonvaEventObject<DragEvent>) {
    const stage = e.target.getStage()
    const pointer = pressRef.current ?? stage?.getPointerPosition()
    pressRef.current = null
    if (!pointer) return
    draggedRef.current = true
    cancelLongPress()
    const present = new Set(marks.map((x) => x.id))
    const selected = (selectedIds ?? []).filter((id) => present.has(id))
    let ids: string[]
    if (selected.includes(m.id)) ids = selected
    else if (multiSelect || isAdditive(e.evt)) ids = [...selected, m.id]
    else ids = [m.id]
    const orig: DragState['orig'] = {}
    for (const x of marks) if (ids.includes(x.id)) orig[x.id] = { x: x.x, y: x.y }
    dragRef.current = { anchorId: m.id, ids, orig, pointer: { x: pointer.x, y: pointer.y } }
    // 끄는 이름표가 다른 이름표 밑에 깔리지 않게 맨 위로 올린다. (잡은 사람이 가장 위)
    const layer = e.target.getLayer()
    layer
      ?.getChildren((n) => ids.includes(n.getAttr('markId')) && n !== e.target)
      .forEach((n) => n.moveToTop())
    e.target.moveToTop()
    setDragIds(ids)
    onMoveStart?.(ids)
  }

  /**
   * 끄는 중: 손이 움직인 만큼(dx, dy)을 무대 좌표로 바꾸고, 잡은 사람을 가까운 기준에 붙인 뒤,
   * 모두가 무대 안에 남는 만큼만 같은 dx·dy로 옮긴다.
   */
  function handleDragMove(m: Mark, e: Konva.KonvaEventObject<DragEvent>) {
    const d = dragRef.current
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!d || d.anchorId !== m.id || !pointer || floorW <= 0) return
    // 반대쪽에서 볼 때는 화면 오른쪽이 무대 왼쪽이므로 방향을 뒤집는다.
    const dir = flipped ? -1 : 1
    const start = d.orig[d.anchorId]
    const raw = {
      x: start.x + ((pointer.x - d.pointer.x) / floorW) * dir,
      y: start.y + ((pointer.y - d.pointer.y) / floorH) * dir,
    }
    // 함께 움직이는 사람끼리는 서로 맞춤 기준이 되지 않게 뺀다.
    const moving = new Set(d.ids)
    const targets = marks
      .filter((x) => !moving.has(x.id) && (x.opacity ?? 1) > 0)
      .map((x) => ({ id: x.id, x: x.x, y: x.y }))
    // Alt를 누른 채 끌면 붙지 않고 자유롭게 옮긴다. (파워포인트와 같다)
    const free = Boolean((e.evt as MouseEvent | undefined)?.altKey)
    const snap: SnapResult = free ? { ...raw } : snapPoint(raw, targets, { floorW, floorH })
    const want = { dx: snap.x - start.x, dy: snap.y - start.y }
    const delta = clampGroupDelta(Object.values(d.orig), want.dx, want.dy)
    // 무대 끝에 막혀 덜 움직였으면 그 방향의 맞춤선은 맞지 않으므로 지운다.
    const xOk = delta.dx === want.dx
    const yOk = delta.dy === want.dy
    const moves = d.ids.map((id) => {
      const o = d.orig[id]
      // 잡은 사람은 붙은 값을 그대로 써서 소수점 오차 없이 정확히 맞춘다.
      if (id === d.anchorId) {
        return {
          id,
          x: xOk ? snap.x : o.x + delta.dx,
          y: yOk ? snap.y : o.y + delta.dy,
        }
      }
      return { id, x: o.x + delta.dx, y: o.y + delta.dy }
    })
    const anchor = moves.find((mv) => mv.id === d.anchorId)!
    e.target.position(toView(anchor.x, anchor.y))
    setGuides({
      anchor: { x: anchor.x, y: anchor.y },
      xGuide: xOk ? snap.xGuide : undefined,
      yGuide: yOk ? snap.yGuide : undefined,
    })
    emitMoves(moves)
  }

  function handleDragEnd() {
    dragRef.current = null
    setDragIds(null)
    setGuides(null)
  }

  function startLongPress(stage: Konva.Stage) {
    if (!onLongPressEmpty) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const p = toStage(pos.x, pos.y)
    longPressFired.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      onLongPressEmpty(p.x, p.y)
      longPressTimer.current = null
    }, 600)
  }

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  /** 작은 알약 모양 글자 (거리·자리 이름). align이 center면 x가 가운데가 된다. */
  function pill(key: string, text: string, x: number, y: number, align: 'left' | 'center' = 'left') {
    const left = align === 'center' ? x - pillWidth(text) / 2 : x
    return (
      <Label key={key} x={left} y={y}>
        <Tag
          fill={colors.guide}
          cornerRadius={9}
          pointerDirection="none"
          shadowColor="#000"
          shadowOpacity={0.18}
          shadowBlur={3}
        />
        <Text
          text={text}
          fontSize={PILL_FONT}
          fontFamily={CANVAS_FONT}
          fontStyle="bold"
          fill="#ffffff"
          padding={PILL_PAD}
        />
      </Label>
    )
  }

  /** 맞춤선 (이름표 아래에 깔린다) */
  function renderGuideLines(g: ActiveGuides) {
    const a = toView(g.anchor.x, g.anchor.y)
    const nodes: React.ReactNode[] = []
    const stroke = colors.guide
    const markOf = (id: string) => marks.find((m) => m.id === id)

    if (g.xGuide) {
      const vx = a.x
      if (g.xGuide.kind === 'mark') {
        const t = markOf(g.xGuide.targetId)
        if (t) {
          const tv = toView(t.x, t.y)
          const top = Math.min(a.y, tv.y) - iconR - 6
          const bottom = Math.max(a.y, tv.y) + iconR + 6
          nodes.push(
            <Line key="gx" points={[vx, top, vx, bottom]} stroke={stroke} strokeWidth={1.5} />,
          )
        }
      } else if (g.xGuide.kind === 'center') {
        nodes.push(
          <Line
            key="gx"
            points={[vx, PAD, vx, PAD + floorH]}
            stroke={stroke}
            strokeWidth={1.5}
            dash={[6, 5]}
          />,
        )
      } else {
        // 번호 자리: 이름표에서 무대 앞 번호 줄까지 잇는다.
        const edgeY = flipped ? PAD : PAD + floorH
        nodes.push(
          <Line
            key="gx"
            points={[vx, a.y, vx, edgeY]}
            stroke={stroke}
            strokeWidth={1.5}
            dash={[4, 4]}
          />,
        )
      }
    }

    if (g.yGuide) {
      const vy = a.y
      if (g.yGuide.kind === 'mark') {
        const t = markOf(g.yGuide.targetId)
        if (t) {
          const tv = toView(t.x, t.y)
          const left = Math.min(a.x, tv.x) - iconR - 6
          const right = Math.max(a.x, tv.x) + iconR + 6
          nodes.push(
            <Line key="gy" points={[left, vy, right, vy]} stroke={stroke} strokeWidth={1.5} />,
          )
        }
      } else {
        nodes.push(
          <Line
            key="gy"
            points={[PX, vy, PX + floorW, vy]}
            stroke={stroke}
            strokeWidth={1.5}
            dash={[6, 5]}
          />,
        )
      }
    }
    return nodes
  }

  /** 맞춤선 글자: 친구 사이 실제 거리(m)와 붙은 자리 이름 */
  function renderGuideLabels(g: ActiveGuides) {
    const a = toView(g.anchor.x, g.anchor.y)
    const nodes: React.ReactNode[] = []
    const markOf = (id: string) => marks.find((m) => m.id === id)

    // 같은 x에 맞췄으면 세로(앞뒤) 거리, 같은 y에 맞췄으면 가로(좌우) 거리
    if (g.xGuide?.kind === 'mark') {
      const t = markOf(g.xGuide.targetId)
      if (t) {
        const meters = Math.abs(g.anchor.y - t.y) * stageDepthM
        if (meters >= 0.05) {
          const tv = toView(t.x, t.y)
          nodes.push(pill('dx', formatMeters(meters), a.x + 6, (a.y + tv.y) / 2 - 10))
        }
      }
    }
    if (g.yGuide?.kind === 'mark') {
      const t = markOf(g.yGuide.targetId)
      if (t) {
        const meters = Math.abs(g.anchor.x - t.x) * stageWidthM
        if (meters >= 0.05) {
          const tv = toView(t.x, t.y)
          nodes.push(pill('dy', formatMeters(meters), (a.x + tv.x) / 2, a.y - 26, 'center'))
        }
      }
    }

    // 무대 가운데·번호 자리에 붙었으면 이름표 위에 짧게 알려 준다.
    const words: string[] = []
    if (g.xGuide?.kind === 'step') words.push(describeMarkStep(g.xGuide.k))
    if (g.xGuide?.kind === 'center' && g.yGuide?.kind === 'center') words.push('무대 한가운데')
    else if (g.xGuide?.kind === 'center' || g.yGuide?.kind === 'center') words.push('무대 가운데')
    if (words.length > 0) {
      nodes.push(pill('where', words.join(' · '), a.x, a.y - iconR - 30, 'center'))
    }
    return nodes
  }

  /** 화면 낭독기가 읽을 수 있는 설명 (캔버스는 그림이라 읽지 못한다) */
  const spokenSummary = useMemo(() => {
    if (marks.length === 0) return '무대 평면도예요. 아직 놓인 친구가 없어요.'
    const where = (m: Mark) =>
      `${m.label} — ${describePosition(m.x)}, ${m.y < 0.34 ? '무대 뒤' : m.y > 0.66 ? '무대 앞' : '가운데'}`
    return `무대 평면도예요. ${marks.length}명이 있어요. ${marks.map(where).join(', ')}.`
  }, [marks])

  return (
    <div className="stage-plan" ref={ref}>
      <p className="sr-only" role="img" aria-label={spokenSummary} />
      {floorW > 0 && (
        <Stage
          ref={stageRef}
          width={width}
          height={viewH}
          onPointerDown={(e) => {
            longPressFired.current = false
            draggedRef.current = false
            if (e.target === e.target.getStage()) startLongPress(e.target.getStage()!)
          }}
          onPointerUp={(e) => {
            const handled = longPressFired.current || draggedRef.current
            draggedRef.current = false
            cancelLongPress()
            // 빈 바닥을 짧게 눌렀을 때만 '한 번 누르기'로 본다.
            if (!handled && onTapEmpty && e.target === e.target.getStage()) {
              const pos = e.target.getStage()!.getPointerPosition()
              if (pos) {
                const p = toStage(pos.x, pos.y)
                onTapEmpty(p.x, p.y)
              }
            }
          }}
          onPointerMove={cancelLongPress}
          onPointerLeave={cancelLongPress}
        >
          <Layer listening={false} key={fontReady ? 'bg-f' : 'bg'}>
            {/* 그림으로 저장할 때 바탕이 비지 않도록 */}
            <Rect x={0} y={0} width={width} height={viewH} fill={colors.bg} />

            {/* 무대 마루 */}
            <Rect
              x={PX}
              y={PAD}
              width={floorW}
              height={floorH}
              fill={colors.floor}
              cornerRadius={8}
            />
            {planks.map((y, i) => (
              <Line
                key={i}
                points={[PX, PAD + y, PX + floorW, PAD + y]}
                stroke={colors.plank}
                strokeWidth={1}
                opacity={0.4}
              />
            ))}

            {/* 스파이크 테이프처럼 점선으로 그린 9구역 */}
            {showGrid &&
              [1, 2].map((i) => (
                <Group key={`g${i}`}>
                  <Line
                    points={[
                      PX + (floorW / 3) * i,
                      PAD,
                      PX + (floorW / 3) * i,
                      PAD + floorH,
                    ]}
                    stroke={colors.tape}
                    strokeWidth={2}
                    dash={[8, 7]}
                  />
                  <Line
                    points={[
                      PX,
                      PAD + (floorH / 3) * i,
                      PX + floorW,
                      PAD + (floorH / 3) * i,
                    ]}
                    stroke={colors.tape}
                    strokeWidth={2}
                    dash={[8, 7]}
                  />
                </Group>
              ))}

            {/* 무대 테두리 */}
            <Rect
              x={PX}
              y={PAD}
              width={floorW}
              height={floorH}
              stroke={colors.border}
              strokeWidth={3}
              cornerRadius={8}
            />

            {/* 무대 앞쪽 센터 기준 번호 (바닥 테이프 표시) */}
            {showMarks &&
              frontStageMarks().map((mark) => {
                // 반대쪽에서 볼 때는 '앞쪽'이 화면 위가 된다.
                const vx = PX + (flipped ? 1 - mark.x : mark.x) * floorW
                const edgeY = flipped ? PAD : PAD + floorH
                const dir = flipped ? -1 : 1
                const tickLen = mark.center ? 16 : 10
                return (
                  <Group key={`mk${mark.x}`}>
                    <Line
                      points={[vx, edgeY - dir * tickLen, vx, edgeY + dir * 3]}
                      stroke={mark.center ? colors.centerMark : colors.tape}
                      strokeWidth={mark.center ? 4 : 2.5}
                      lineCap="round"
                    />
                    <Text
                      text={mark.label}
                      x={vx - 14}
                      y={flipped ? edgeY - dir * tickLen - 20 : edgeY + 6}
                      width={28}
                      align="center"
                      fontSize={mark.center ? 15 : 13}
                      fontFamily={CANVAS_FONT}
                      fontStyle={mark.center ? 'bold' : 'normal'}
                      fill={mark.center ? colors.centerMark : colors.label}
                    />
                  </Group>
                )
              })}

            {/* 라벨: 위쪽 무대 뒤, 아래쪽 객석 */}
            <Text
              text={flipped ? '객석' : '무대 뒤'}
              x={PX}
              y={showMarks && flipped ? 2 : 8}
              width={floorW}
              align="center"
              fontSize={16}
              fontFamily={CANVAS_FONT}
              fill={colors.label}
            />
            <Text
              text={flipped ? '무대 뒤' : '객석'}
              x={PX}
              y={PAD + floorH + (showMarks && !flipped ? 26 : 8)}
              width={floorW}
              align="center"
              fontSize={16}
              fontFamily={CANVAS_FONT}
              fill={colors.label}
            />
            <Text
              text={`${stageWidthM}m × ${stageDepthM}m`}
              x={PX}
              y={10}
              width={floorW}
              align="right"
              fontSize={13}
              fontFamily={CANVAS_FONT}
              fill={colors.label}
            />
          </Layer>

          {/* 지나온 길 */}
          <Layer listening={false}>
            {trails
              .filter((t) => t.points.length >= 2)
              .map((t) => (
                <Line
                  key={`trail-${t.id}`}
                  points={t.points.flatMap((p) => {
                    const v = toView(p.x, p.y)
                    return [v.x, v.y]
                  })}
                  stroke={t.color}
                  strokeWidth={3}
                  dash={[9, 7]}
                  lineCap="round"
                  lineJoin="round"
                  opacity={t.faded ? 0.18 : 0.7}
                  tension={0.25}
                />
              ))}
          </Layer>

          {/* 이전 컷 자리 (흐린 아이콘 + 점선 화살표) */}
          <Layer listening={false}>
            {ghosts.map((g) => {
              const from = toView(g.x, g.y)
              const now = marks.find((m) => m.id === g.id)
              return (
                <Group key={`ghost-${g.id}`}>
                  <Circle
                    x={from.x}
                    y={from.y}
                    radius={iconR}
                    fill={g.color}
                    opacity={0.28}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  {now && (now.x !== g.x || now.y !== g.y) && (
                    <Arrow
                      points={[from.x, from.y, toView(now.x, now.y).x, toView(now.x, now.y).y]}
                      stroke={g.color}
                      fill={g.color}
                      strokeWidth={2.5}
                      dash={[7, 6]}
                      opacity={0.75}
                      pointerLength={9}
                      pointerWidth={9}
                    />
                  )}
                </Group>
              )
            })}
          </Layer>

          {/* 끄는 동안만 잠깐 보이는 맞춤선 */}
          {guides && <Layer listening={false}>{renderGuideLines(guides)}</Layer>}

          {/* 학생 아이콘 */}
          <Layer key={fontReady ? 'marks-f' : 'marks'}>
            {marks.map((m) => {
              const pos = viewPos[m.id] ?? toView(m.x, m.y)
              const selected = selectedSet.has(m.id)
              return (
                <Group
                  key={m.id}
                  markId={m.id}
                  x={pos.x}
                  y={pos.y}
                  draggable={canDrag}
                  opacity={(m.opacity ?? 1) * (m.faded ? 0.28 : 1)}
                  onClick={(e) =>
                    onSelectMark?.(m.id, { additive: multiSelect || isAdditive(e.evt) })
                  }
                  onTap={(e) =>
                    onSelectMark?.(m.id, { additive: multiSelect || isAdditive(e.evt) })
                  }
                  onPointerDown={(e) => {
                    const p = e.target.getStage()?.getPointerPosition()
                    pressRef.current = p ? { x: p.x, y: p.y } : null
                  }}
                  onDragStart={(e) => handleDragStart(m, e)}
                  onDragMove={(e) => handleDragMove(m, e)}
                  onDragEnd={handleDragEnd}
                >
                  <Circle radius={iconR + 2} fill="rgba(31,42,68,0.22)" y={2} listening={false} />
                  {/* 고른 친구: 이름표는 그대로 두고 바깥에만 테두리를 두른다. (그림 저장 때는 빠진다) */}
                  {selected && (
                    <Circle
                      name="selection-ring"
                      radius={iconR + 7}
                      stroke={colors.select}
                      strokeWidth={3}
                      listening={false}
                    />
                  )}
                  <Circle radius={iconR} fill={m.color} stroke="#ffffff" strokeWidth={4} />
                  <Text
                    text={m.label}
                    fontSize={Math.max(11, iconR * 0.66)}
                    fontFamily={CANVAS_FONT}
                    fontStyle="bold"
                    fill={textColorOn(m.color)}
                    width={iconR * 4}
                    height={iconR * 4}
                    offsetX={iconR * 2}
                    offsetY={iconR * 2}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                </Group>
              )
            })}
          </Layer>

          {/* 맞춤선 글자(거리·자리 이름)는 이름표에 가리지 않게 맨 위에 */}
          {guides && <Layer listening={false}>{renderGuideLabels(guides)}</Layer>}
        </Stage>
      )}
    </div>
  )
}
