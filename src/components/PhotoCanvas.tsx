import { useMemo, useRef, useState } from 'react'
import { Circle, Group, Image as KImage, Layer, Line, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { Point } from '../db/types'
import { useElementSize } from '../lib/useElementSize'

interface Props {
  image: HTMLImageElement
  /** 지금까지 찍은 귀퉁이 (사진 좌표) */
  corners: Point[]
  /** 사진의 빈 곳을 눌렀을 때 */
  onTapImage?: (p: Point) => void
  /** 귀퉁이 점을 끌어 옮겼을 때 */
  onMoveCorner?: (index: number, p: Point) => void
  /** 사진 위에 함께 그릴 것들 (다음 단계에서 인식 박스가 들어온다) */
  children?: React.ReactNode
  /** 돋보기 사용 여부 */
  magnify?: boolean
}

/** 사진 위에서 무대 귀퉁이를 찍고 옮기는 캔버스 */
export default function PhotoCanvas({
  image,
  corners,
  onTapImage,
  onMoveCorner,
  children,
  magnify = true,
}: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const stageRef = useRef<Konva.Stage>(null)
  const [lens, setLens] = useState<Point | null>(null)

  // 사진을 칸 너비에 맞춰 줄인다.
  const scale = width > 0 ? width / image.width : 0
  const viewW = width
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

  return (
    <div className="photo-canvas" ref={ref}>
      {scale > 0 && (
        <Stage
          ref={stageRef}
          width={viewW}
          height={viewH}
          onPointerDown={(e) => {
            const p = toImagePoint(e.target.getStage()!)
            if (p && magnify) setLens(p)
          }}
          onPointerMove={(e) => {
            if (!lens) return
            const p = toImagePoint(e.target.getStage()!)
            if (p) setLens(p)
          }}
          onPointerUp={(e) => {
            const stage = e.target.getStage()!
            const p = toImagePoint(stage)
            setLens(null)
            // 점 위를 눌렀다 뗀 것이면 새 점을 찍지 않는다.
            const onMarker = e.target.name() === 'corner-marker'
            if (p && !onMarker) onTapImage?.(p)
          }}
          onPointerLeave={() => setLens(null)}
        >
          <Layer listening={false}>
            <KImage image={image} width={viewW} height={viewH} />
          </Layer>

          <Layer>
            {corners.length >= 2 && (
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
            {corners.length === 4 && (
              <Line points={flatPoints} closed fill="rgba(255, 210, 63, 0.16)" listening={false} />
            )}

            {corners.map((c, i) => (
              <Group
                key={i}
                x={c.x * scale}
                y={c.y * scale}
                draggable
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
                  name="corner-marker"
                  text={String(i + 1)}
                  fontSize={18}
                  fontStyle="bold"
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

            {children}
          </Layer>
        </Stage>
      )}

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
