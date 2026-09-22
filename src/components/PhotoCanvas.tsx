import { CANVAS_FONT } from '../lib/canvasFont'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Image as KImage, Layer, Line, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { Point } from '../db/types'
import { useElementSize } from '../lib/useElementSize'

interface Props {
  image: HTMLImageElement
  /** 지금까지 찍은 무대 귀퉁이 (사진 좌표) */
  corners: Point[]
  /** 귀퉁이 점과 테두리를 보여 줄지 */
  showCorners?: boolean
  /** 사진의 빈 곳을 눌렀을 때 */
  onTapImage?: (p: Point) => void
  /** 사진의 빈 곳을 길게 눌렀을 때 */
  onLongPress?: (p: Point) => void
  /** 귀퉁이 점을 끌어 옮겼을 때 */
  onMoveCorner?: (index: number, p: Point) => void
  /** 사진 위에 함께 그릴 것들. 화면 배율(scale)을 받아 그린다. */
  children?: (scale: number) => React.ReactNode
  /** 돋보기 사용 여부 */
  magnify?: boolean
}

/**
 * 사진을 보여 줄 수 있는 최대 높이.
 * 세로로 긴 사진도 한눈에 들어오고, 아래의 버튼들이 화면 밖으로 밀리지 않게 한다.
 */
function useMaxPhotoHeight() {
  const [maxHeight, setMaxHeight] = useState(() =>
    typeof window === 'undefined' ? 600 : Math.max(280, window.innerHeight * 0.62),
  )

  useEffect(() => {
    const update = () => setMaxHeight(Math.max(280, window.innerHeight * 0.62))
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return maxHeight
}

/** 사진 위에서 무대 귀퉁이를 찍고, 인식 결과를 함께 보여 주는 캔버스 */
export default function PhotoCanvas({
  image,
  corners,
  showCorners = true,
  onTapImage,
  onLongPress,
  onMoveCorner,
  children,
  magnify = true,
}: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const [lens, setLens] = useState<Point | null>(null)
  const longPress = useRef<{ timer: number; point: Point } | null>(null)
  // 길게 누르기가 이미 처리됐으면, 손을 뗄 때 '누르기'로 또 처리하지 않는다.
  const longPressFired = useRef(false)

  // 사진을 칸 너비에 맞추되, 세로로 긴 사진이 화면을 다 차지하지 않도록 높이도 제한한다.
  const maxHeight = useMaxPhotoHeight()
  const scale =
    width > 0 ? Math.min(width / image.width, maxHeight / image.height) : 0
  const viewW = Math.round(image.width * scale)
  const viewH = Math.round(image.height * scale)

  const flatPoints = useMemo(
    () => corners.flatMap((c) => [c.x * scale, c.y * scale]),
    [corners, scale],
  )

  /** 화면 좌표 → 사진 좌표 */
  function toImagePoint(stage: Konva.Stage): Point | null {
    const pos = stage.getPointerPosition()
    if (!pos || scale === 0) return null
    return {
      x: Math.min(image.width, Math.max(0, pos.x / scale)),
      y: Math.min(image.height, Math.max(0, pos.y / scale)),
    }
  }

  function cancelLongPress() {
    if (longPress.current) {
      clearTimeout(longPress.current.timer)
      longPress.current = null
    }
  }

  return (
    <div className="photo-canvas" ref={ref}>
      <p
        className="sr-only"
        role="img"
        aria-label={
          corners.length === 4
            ? '연습 사진이에요. 무대 네 귀퉁이를 모두 정했어요.'
            : `연습 사진이에요. 무대 귀퉁이를 ${corners.length}개 정했어요.`
        }
      />
      <div className="photo-canvas-inner" style={{ width: viewW || '100%' }}>
      {scale > 0 && (
        <Stage
          width={viewW}
          height={viewH}
          onPointerDown={(e) => {
            const stage = e.target.getStage()
            if (!stage) return
            const p = toImagePoint(stage)
            if (!p) return
            if (magnify) setLens(p)
            longPressFired.current = false
            if (onLongPress) {
              const timer = window.setTimeout(() => {
                longPress.current = null
                longPressFired.current = true
                setLens(null)
                onLongPress(p)
              }, 600)
              longPress.current = { timer, point: p }
            }
          }}
          onPointerMove={(e) => {
            if (longPress.current) {
              // 손가락이 많이 움직이면 "길게 누르기"가 아니다.
              const p = toImagePoint(e.target.getStage()!)
              if (p) {
                const moved = Math.hypot(
                  p.x - longPress.current.point.x,
                  p.y - longPress.current.point.y,
                )
                if (moved > 12) cancelLongPress()
              }
            }
            if (!lens) return
            const p = toImagePoint(e.target.getStage()!)
            if (p) setLens(p)
          }}
          onPointerUp={(e) => {
            const stage = e.target.getStage()!
            const p = toImagePoint(stage)
            const handled = longPressFired.current
            cancelLongPress()
            setLens(null)
            // 표시된 것 위를 눌렀다 뗀 것이면 새 점을 찍지 않는다.
            const onMarker = e.target.name() === 'corner-marker' || e.target.name() === 'overlay'
            if (p && !onMarker && !handled) onTapImage?.(p)
          }}
          onPointerLeave={() => {
            cancelLongPress()
            setLens(null)
          }}
        >
          <Layer listening={false}>
            <KImage image={image} width={viewW} height={viewH} />
          </Layer>

          <Layer>
            {showCorners && corners.length >= 2 && (
              <Line
                points={flatPoints}
                closed={corners.length === 4}
                stroke="#FFD23F"
                strokeWidth={3}
                dash={[10, 8]}
                shadowColor="#1F2A44"
                shadowBlur={4}
                listening={false}
              />
            )}
            {showCorners && corners.length === 4 && (
              <Line points={flatPoints} closed fill="rgba(255, 210, 63, 0.16)" listening={false} />
            )}

            {showCorners &&
              corners.map((c, i) => (
                <Group
                  key={i}
                  x={c.x * scale}
                  y={c.y * scale}
                  draggable={Boolean(onMoveCorner)}
                  onDragMove={(e) => {
                    const p = {
                      x: Math.min(image.width, Math.max(0, e.target.x() / scale)),
                      y: Math.min(image.height, Math.max(0, e.target.y() / scale)),
                    }
                    if (magnify) setLens(p)
                    onMoveCorner?.(i, p)
                  }}
                  onDragEnd={() => setLens(null)}
                >
                  <Circle name="corner-marker" radius={22} fill="rgba(31,42,68,0.25)" />
                  <Circle
                    name="corner-marker"
                    radius={16}
                    fill="#FF6B4A"
                    stroke="#ffffff"
                    strokeWidth={4}
                  />
                  <Text
                    text={String(i + 1)}
                    fontSize={18}
                    fontFamily={CANVAS_FONT}
                    fill="#ffffff"
                    width={40}
                    height={40}
                    offsetX={20}
                    offsetY={20}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                </Group>
              ))}

            {children?.(scale)}
          </Layer>
        </Stage>
      )}

      </div>

      {lens && scale > 0 && (
        <Magnifier
          image={image}
          point={lens}
          /* 손가락 반대쪽 위 구석에 띄워서 가리지 않게 한다 */
          side={lens.x / image.width > 0.5 ? 'left' : 'right'}
        />
      )}
    </div>
  )
}

/** 누르는 동안 옆에 뜨는 확대 돋보기 */
function Magnifier({
  image,
  point,
  side,
}: {
  image: HTMLImageElement
  point: Point
  side: 'left' | 'right'
}) {
  const SIZE = 132
  const ZOOM = 3
  return (
    <div
      className={`magnifier magnifier-${side}`}
      style={{
        width: SIZE,
        height: SIZE,
        backgroundImage: `url(${image.src})`,
        backgroundSize: `${image.width * ZOOM}px ${image.height * ZOOM}px`,
        backgroundPosition: `${SIZE / 2 - point.x * ZOOM}px ${SIZE / 2 - point.y * ZOOM}px`,
      }}
      aria-hidden="true"
    >
      <span className="magnifier-cross magnifier-cross-h" />
      <span className="magnifier-cross magnifier-cross-v" />
    </div>
  )
}
