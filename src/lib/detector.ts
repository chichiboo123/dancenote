import type { Detection, ObjectDetector } from '@mediapipe/tasks-vision'

/**
 * 사진에서 "사람 모양"만 찾아 주는 도구.
 *
 * - 얼굴을 알아보지 않는다. 사람의 형태(네모난 영역)만 찾는다.
 * - wasm과 모델 파일을 모두 이 앱 안에 담아 두어서, 인터넷이 없어도 동작한다.
 */

export interface PersonBox {
  /** 사진 좌표 기준 네모 [x, y, 너비, 높이] */
  bbox: [number, number, number, number]
  /** 얼마나 확신하는지 0~1 */
  score: number
}

/** MediaPipe 파일들이 있는 곳 (GitHub Pages의 하위 경로까지 포함) */
function assetBase(): string {
  return new URL('models/', document.baseURI).href.replace(/\/$/, '')
}

let detectorPromise: Promise<ObjectDetector> | null = null

/** 인식기를 한 번만 만들어 두고 계속 다시 쓴다. (처음 한 번이 제일 오래 걸린다) */
export function getDetector(): Promise<ObjectDetector> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((err) => {
      // 실패하면 다음에 다시 시도할 수 있게 비워 둔다.
      detectorPromise = null
      throw err
    })
  }
  return detectorPromise
}

async function createDetector(): Promise<ObjectDetector> {
  // 무거운 라이브러리라서, 실제로 쓸 때만 불러온다. (첫 화면이 가벼워진다)
  const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision')
  const base = assetBase()
  const fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`)
  const options = {
    baseOptions: {
      modelAssetPath: `${base}/efficientdet_lite0.tflite`,
      delegate: 'GPU' as const,
    },
    scoreThreshold: 0.2,
    maxResults: 40,
    runningMode: 'IMAGE' as const,
    categoryAllowlist: ['person'],
  }

  try {
    return await ObjectDetector.createFromOptions(fileset, options)
  } catch {
    // 그래픽 가속이 안 되는 기기에서는 일반 계산(CPU)으로 다시 시도한다.
    return ObjectDetector.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'CPU' },
    })
  }
}

/**
 * 미리 준비시켜 두면 실제 인식할 때 기다리는 시간이 크게 줄어든다.
 * 처음 한 번은 빈 그림으로 연습 삼아 돌려서, 진짜 사진을 넣을 때 바로 답이 나오게 한다.
 */
export function warmUpDetector() {
  getDetector()
    .then((detector) => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      detector.detect(canvas)
    })
    .catch(() => {
      /* 준비에 실패해도 화면은 계속 쓸 수 있다. 실제 인식할 때 다시 알려 준다. */
    })
}

/**
 * 사진에서 사람을 찾는다.
 * @param minScore 0~1. 낮출수록 더 많이 찾고, 높일수록 확실한 것만 찾는다.
 */
export async function detectPeople(
  image: HTMLImageElement | HTMLCanvasElement,
  minScore = 0.35,
): Promise<PersonBox[]> {
  const detector = await getDetector()
  const result = detector.detect(image)
  return toPersonBoxes(result.detections, minScore)
}

/** MediaPipe 결과를 앱에서 쓰는 모양으로 바꾼다. */
export function toPersonBoxes(detections: Detection[], minScore: number): PersonBox[] {
  const boxes: PersonBox[] = []
  for (const d of detections) {
    const category = d.categories?.[0]
    if (!category) continue
    if (category.categoryName !== 'person') continue
    if (category.score < minScore) continue
    const b = d.boundingBox
    if (!b) continue
    boxes.push({
      bbox: [b.originX, b.originY, b.width, b.height],
      score: category.score,
    })
  }
  // 확신이 큰 것부터
  return boxes.sort((a, b) => b.score - a.score)
}

/** 사람 네모의 "발 위치" = 아래쪽 가운데 점 */
export function footPoint(bbox: [number, number, number, number]) {
  const [x, y, w, h] = bbox
  return { x: x + w / 2, y: y + h }
}

/** 두 네모가 얼마나 겹치는지 (0~1). 같은 사람을 두 번 넣지 않으려고 쓴다. */
export function overlapRatio(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[0] + a[2], b[0] + b[2])
  const y2 = Math.min(a[1] + a[3], b[1] + b[3])
  if (x2 <= x1 || y2 <= y1) return 0
  const inter = (x2 - x1) * (y2 - y1)
  return inter / (a[2] * a[3] + b[2] * b[3] - inter)
}
