import { useMemo, useRef } from 'react'
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import { useElementSize } from '../lib/useElementSize'
import { textColorOn } from '../lib/colors'
import { usePlanColors } from '../lib/planColors'

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
}

interface Props {
  stageWidthM: number
  stageDepthM: number
  marks: Mark[]
  /** 이전 컷 위치 (흐린 아이콘 + 점선 화살표) */
  ghosts?: Mark[]
  showGrid?: boolean
  /** 아이콘을 끌어 옮겼을 때 (무대 좌표 0~1) */
  onMoveMark?: (id: string, x: number, y: number) => void
  /** 빈 곳을 길게 눌렀을 때 */
  onLongPressEmpty?: (x: number, y: number) => void
  /** 아이콘을 눌렀을 때 */
  onSelectMark?: (id: string) => void
}

const PAD = 34 // 라벨이 들어갈 바깥 여백

/** 위에서 내려다본 무대 평면도. 아래쪽이 객석, 위쪽이 무대 뒤. */
export default function StagePlan({
  stageWidthM,
  stageDepthM,
  marks,
  ghosts = [],
  showGrid = false,
  onMoveMark,
  onLongPressEmpty,
  onSelectMark,
}: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const colors = usePlanColors()
  const longPressTimer = useRef<number | null>(null)

  const ratio = stageDepthM / stageWidthM
  const floorW = Math.max(0, width - PAD * 2)
  const floorH = floorW * ratio
  const viewH = floorH + PAD * 2

  /** 무대 좌표(0~1) → 화면 좌표 */
  const toView = useMemo(
    () => (x: number, y: number) => ({ x: PAD + x * floorW, y: PAD + y * floorH }),
    [floorW, floorH],
  )

  /** 화면 좌표 → 무대 좌표(0~1) */
  function toStage(px: number, py: number) {
    return {
      x: Math.min(1, Math.max(0, (px - PAD) / floorW)),
      y: Math.min(1, Math.max(0, (py - PAD) / floorH)),
    }
  }

  // 나뭇결 무늬 (마루판 느낌)
  const planks = useMemo(() => {
    const lines: number[] = []
    const count = 7
    for (let i = 1; i < count; i++) lines.push((floorH / count) * i)
    return lines
  }, [floorH])

  const iconR = Math.max(16, Math.min(28, floorW / 18))

  function startLongPress(stage: Konva.Stage) {
    if (!onLongPressEmpty) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const p = toStage(pos.x, pos.y)
    longPressTimer.current = window.setTimeout(() => {
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

  return (
    <div className="stage-plan" ref={ref}>
      {floorW > 0 && (
        <Stage
          width={width}
          height={viewH}
          onPointerDown={(e) => {
            if (e.target === e.target.getStage()) startLongPress(e.target.getStage()!)
          }}
          onPointerUp={cancelLongPress}
          onPointerMove={cancelLongPress}
          onPointerLeave={cancelLongPress}
        >
          <Layer listening={false}>
            {/* 무대 마루 */}
            <Rect
              x={PAD}
              y={PAD}
              width={floorW}
              height={floorH}
              fill={colors.floor}
              cornerRadius={8}
            />
            {planks.map((y, i) => (
              <Line
                key={i}
                points={[PAD, PAD + y, PAD + floorW, PAD + y]}
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
                      PAD + (floorW / 3) * i,
                      PAD,
                      PAD + (floorW / 3) * i,
                      PAD + floorH,
                    ]}
                    stroke={colors.tape}
                    strokeWidth={2}
                    dash={[8, 7]}
                  />
                  <Line
                    points={[
                      PAD,
                      PAD + (floorH / 3) * i,
                      PAD + floorW,
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
              x={PAD}
              y={PAD}
              width={floorW}
              height={floorH}
              stroke={colors.border}
              strokeWidth={3}
              cornerRadius={8}
            />

            {/* 라벨: 위쪽 무대 뒤, 아래쪽 객석 */}
            <Text
              text="무대 뒤"
              x={PAD}
              y={8}
              width={floorW}
              align="center"
              fontSize={16}
              fontFamily="Jua, sans-serif"
              fill={colors.label}
            />
            <Text
              text="객석"
              x={PAD}
              y={PAD + floorH + 8}
              width={floorW}
              align="center"
              fontSize={16}
              fontFamily="Jua, sans-serif"
              fill={colors.label}
            />
            <Text
              text={`${stageWidthM}m`}
              x={PAD}
              y={PAD + floorH + 8}
              width={floorW}
              align="right"
              fontSize={13}
              fill={colors.label}
            />
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
          <Layer>
            {marks.map((m) => {
              const pos = toView(m.x, m.y)
              return (
                <Group
                  key={m.id}
                  x={pos.x}
                  y={pos.y}
                  draggable={Boolean(onMoveMark)}
                  opacity={m.faded ? 0.3 : 1}
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
                    fontFamily="Jua, sans-serif"
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
