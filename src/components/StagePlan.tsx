import { CANVAS_FONT, useCanvasFontReady } from '../lib/canvasFont'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import { useElementSize } from '../lib/useElementSize'
import { textColorOn } from '../lib/colors'
import { usePlanColors } from '../lib/planColors'
import { describePosition, frontStageMarks } from '../lib/stageMarks'

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
  /** 아이콘을 끌어 옮겼을 때 (무대 좌표 0~1) */
  onMoveMark?: (id: string, x: number, y: number) => void
  /** 빈 곳을 길게 눌렀을 때 */
  onLongPressEmpty?: (x: number, y: number) => void
  /** 아이콘을 눌렀을 때 */
  onSelectMark?: (id: string) => void
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
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
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
  }, [marks, toView, iconR])

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
            if (e.target === e.target.getStage()) startLongPress(e.target.getStage()!)
          }}
          onPointerUp={(e) => {
            const handled = longPressFired.current
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

          {/* 학생 아이콘 */}
          <Layer key={fontReady ? 'marks-f' : 'marks'}>
            {marks.map((m) => {
              const pos = viewPos[m.id] ?? toView(m.x, m.y)
              return (
                <Group
                  key={m.id}
                  x={pos.x}
                  y={pos.y}
                  draggable={Boolean(onMoveMark)}
                  opacity={(m.opacity ?? 1) * (m.faded ? 0.28 : 1)}
                  onClick={() => onSelectMark?.(m.id)}
                  onTap={() => onSelectMark?.(m.id)}
                  onDragMove={(e) => {
                    // 무대 밖으로 나가면 가장자리에 붙인다.
                    const p = toStage(e.target.x(), e.target.y())
                    const v = toView(p.x, p.y)
                    e.target.position(v)
                    onMoveMark?.(m.id, p.x, p.y)
                  }}
                >
                  <Circle radius={iconR + 2} fill="rgba(31,42,68,0.22)" y={2} listening={false} />
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
        </Stage>
      )}
    </div>
  )
}
