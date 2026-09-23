import type { ObjectDetector } from '@mediapipe/tasks-vision'
import type { Point } from '../db/types'
import { createStageMapper } from './homography'

/**
 * 사진에서 "사람 모양"만 찾아 주는 도구.
 *
 * - 얼굴을 알아보지 않는다. 사람의 형태(네모난 영역)만 찾는다.
 * - wasm과 모델 파일을 모두 이 앱 안에 담아 두어서, 인터넷이 없어도 동작한다.
 *
 * 무대 사진은 뒷줄 친구들이 아주 작게 찍히기 때문에 한 번에 통째로 넣으면 잘 놓친다.
 * 그래서 이렇게 여러 번 살핀다.
 *   1. 사진 전체를 한 번
 *   2. 무대 영역 근처만 잘라서 여러 조각(타일)으로 나눠 크게 한 번씩
 *   3. 조각마다 찾은 네모를 하나로 합치고(중복 제거), 조각 경계에서 잘린 네모는 버린다.
 * 그 다음 무대 밖에 선 사람은 빼고, 앞사람에게 다리가 가려진 친구는 발 위치를 짐작해 고친다.
 */

export interface PersonBox {
  /** 사진 좌표 기준 네모 [x, y, 너비, 높이] */
  bbox: [number, number, number, number]
  /** 얼마나 확신하는지 0~1 */
  score: number
  /** 발 위치(사진 좌표). 다리가 가려졌으면 짐작한 자리. 없으면 네모 아래 가운데. */
  foot?: Point
  /** 다리가 가려져서 발 위치를 짐작했는지 */
  footEstimated?: boolean
  /** 무대 영역 밖에 서 있는지 (객석·무대 옆) */
  offStage?: boolean
}

export interface DetectOptions {
  /** 무대 네 귀퉁이(사진 좌표). 주면 무대 근처를 확대해 한 번 더 살피고, 무대 밖 사람을 가려낸다. */
  stageCorners?: readonly Point[]
  /** 살핀 조각 수를 알려 준다. (진행 표시용) */
  onProgress?: (done: number, total: number) => void
}

type Box = [number, number, number, number]

interface RawBox {
  bbox: Box
  score: number
  /** 조각 경계에 걸려 잘렸을 가능성이 있는지 */
  clipped: boolean
}

/** 모델이 받아들이는 그림 한 변 (EfficientDet-Lite2) */
const MODEL_INPUT = 448
/** 아주 낮은 기준으로 모두 받아 두고, 화면의 민감도 슬라이더가 걸러 낸다. */
const RAW_MIN_SCORE = 0.12
/** 한 사진에서 살필 조각 수 상한 (느린 기기 배려) */
const MAX_TILES = 4

/** MediaPipe 파일들이 있는 곳 (GitHub Pages의 하위 경로까지 포함) */
function assetBase(): string {
  return new URL('models/', document.baseURI).href.replace(/\/$/, '')
}

export const MODEL_FILE = 'efficientdet_lite2.tflite'

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
  // 양자화(int8) 모델은 그래픽 가속(GPU)에서 결과가 비어 버려서, 늘 일반 계산(CPU)으로 돌린다.
  // 태블릿에서도 한 번에 0.3~0.6초 정도라 충분히 빠르다.
  return ObjectDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${base}/${MODEL_FILE}`,
      delegate: 'CPU',
    },
    scoreThreshold: RAW_MIN_SCORE,
    maxResults: 50,
    runningMode: 'IMAGE',
    categoryAllowlist: ['person'],
  })
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

/** 한 번 살필 사진 속 영역 */
interface Region {
  x: number
  y: number
  w: number
  h: number
}

/** 무대 근처(사람 머리까지 포함)를 여러 조각으로 나눈다. */
function planTiles(imgW: number, imgH: number, corners?: readonly Point[]): Region[] {
  let rx = 0
  let ry = 0
  let rw = imgW
  let rh = imgH
  if (corners && corners.length === 4) {
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const floorH = maxY - minY
    // 무대 뒤에 선 친구의 머리까지 들어오도록 위쪽을 넉넉히, 옆은 조금만 넓힌다.
    const top = minY - Math.max(floorH * 0.55, imgH * 0.12)
    const padX = (maxX - minX) * 0.04
    rx = Math.max(0, minX - padX)
    ry = Math.max(0, top)
    rw = Math.min(imgW, maxX + padX) - rx
    rh = Math.min(imgH, maxY + floorH * 0.04) - ry
  }
  if (rw < 32 || rh < 32) return []

  // 조각이 모델 입력의 약 2배 정도가 되도록 나눈다. (너무 잘게 나누면 느리고, 사람이 잘린다)
  const target = Math.max(MODEL_INPUT * 1.1, Math.min(rw, rh) * 0.6)
  const overlap = 0.25
  let cols = Math.max(1, Math.ceil((rw - target * overlap) / (target * (1 - overlap))))
  let rows = Math.max(1, Math.ceil((rh - target * overlap) / (target * (1 - overlap))))
  while (cols * rows > MAX_TILES) {
    if (cols >= rows) cols--
    else rows--
  }
  if (cols * rows === 1 && rw >= imgW * 0.9 && rh >= imgH * 0.9) return [] // 전체 한 번과 같다

  const tileW = cols === 1 ? rw : rw / (cols - (cols - 1) * overlap)
  const tileH = rows === 1 ? rh : rh / (rows - (rows - 1) * overlap)
  const regions: Region[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      regions.push({
        x: rx + c * tileW * (1 - overlap),
        y: ry + r * tileH * (1 - overlap),
        w: tileW,
        h: tileH,
      })
    }
  }
  return regions
}

/** 한 영역을 살펴서 사진 좌표로 돌려준다. */
function detectRegion(
  detector: ObjectDetector,
  image: HTMLImageElement | HTMLCanvasElement,
  region: Region | null,
  canvas: HTMLCanvasElement,
  imgW: number,
  imgH: number,
): RawBox[] {
  let input: HTMLImageElement | HTMLCanvasElement = image
  let ox = 0
  let oy = 0
  let k = 1
  if (region) {
    // 조각을 모델 입력보다 조금 크게 그려서 넘긴다. (작게 찍힌 사람이 커진다)
    const scale = Math.min(1.6, (MODEL_INPUT * 1.5) / Math.max(region.w, region.h))
    canvas.width = Math.max(1, Math.round(region.w * scale))
    canvas.height = Math.max(1, Math.round(region.h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return []
    ctx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height)
    input = canvas
    ox = region.x
    oy = region.y
    k = 1 / scale
  }

  const result = detector.detect(input)
  const out: RawBox[] = []
  const inW = region ? canvas.width : imgW
  const inH = region ? canvas.height : imgH
  const edge = 3
  for (const d of result.detections) {
    const category = d.categories?.[0]
    const b = d.boundingBox
    if (!category || !b || category.categoryName !== 'person') continue
    if (category.score < RAW_MIN_SCORE) continue
    // 조각 안쪽 경계(사진 끝이 아닌 곳)에 닿은 네모는 사람이 잘렸을 수 있다.
    const clipped =
      region !== null &&
      ((b.originX <= edge && region.x > 1) ||
        (b.originY <= edge && region.y > 1) ||
        (b.originX + b.width >= inW - edge && region.x + region.w < imgW - 1) ||
        (b.originY + b.height >= inH - edge && region.y + region.h < imgH - 1))
    const x = ox + b.originX * k
    const y = oy + b.originY * k
    const w = b.width * k
    const h = b.height * k
    // 너무 작거나 사진 밖으로 나간 것은 버린다.
    if (w < 6 || h < 10) continue
    const cx = Math.max(0, x)
    const cy = Math.max(0, y)
    out.push({
      bbox: [cx, cy, Math.min(imgW, x + w) - cx, Math.min(imgH, y + h) - cy],
      score: category.score,
      clipped,
    })
  }
  return out
}

/**
 * 사진에서 사람을 찾는다.
 * @param minScore 0~1. 낮출수록 더 많이 찾고, 높일수록 확실한 것만 찾는다.
 */
export async function detectPeople(
  image: HTMLImageElement | HTMLCanvasElement,
  minScore = 0.35,
  options: DetectOptions = {},
): Promise<PersonBox[]> {
  const detector = await getDetector()
  const imgW = image instanceof HTMLImageElement ? image.naturalWidth || image.width : image.width
  const imgH = image instanceof HTMLImageElement ? image.naturalHeight || image.height : image.height
  const tiles = planTiles(imgW, imgH, options.stageCorners)
  const total = tiles.length + 1
  const canvas = document.createElement('canvas')

  const raw: RawBox[] = []
  raw.push(...detectRegion(detector, image, null, canvas, imgW, imgH))
  options.onProgress?.(1, total)
  for (let i = 0; i < tiles.length; i++) {
    // 화면이 멈춘 것처럼 보이지 않도록 조각 사이에 숨 돌릴 틈을 준다.
    await new Promise((r) => setTimeout(r, 0))
    raw.push(...detectRegion(detector, image, tiles[i], canvas, imgW, imgH))
    options.onProgress?.(i + 2, total)
  }

  const merged = mergeBoxes(raw).filter((b) => b.score >= minScore)
  return refineForStage(merged, options.stageCorners, imgH)
}

/**
 * 여러 번 살핀 결과를 하나로 합친다.
 * - 거의 같은 자리의 네모는 하나로 (여러 번 찾을수록 조금 더 확신)
 * - 큰 네모 안에 거의 다 들어가는 작은 네모(몸의 일부만 잡힌 것)는 버린다.
 * - 조각 경계에서 잘린 네모는 다른 네모와 겹치면 버린다.
 */
export function mergeBoxes(raw: RawBox[]): PersonBox[] {
  const sorted = [...raw].sort((a, b) => {
    if (a.clipped !== b.clipped) return a.clipped ? 1 : -1
    return b.score - a.score
  })
  const kept: { bbox: Box; score: number; hits: number }[] = []
  for (const cand of sorted) {
    let absorbed = false
    for (const k of kept) {
      const iou = overlapRatio(cand.bbox, k.bbox)
      const cover = containment(cand.bbox, k.bbox)
      if (iou > 0.45 || cover > 0.75 || (cand.clipped && cover > 0.45)) {
        if (iou > 0.45) k.hits++
        absorbed = true
        break
      }
    }
    if (!absorbed && !(cand.clipped && cand.score < 0.3)) {
      kept.push({ bbox: cand.bbox, score: cand.score, hits: 1 })
    }
  }
  return kept
    .map((k) => ({
      bbox: k.bbox,
      score: Math.min(0.99, k.score + 0.06 * (k.hits - 1)),
    }))
    .sort((a, b) => b.score - a.score)
}

/**
 * 무대 기준으로 다듬는다.
 * - 앞사람에게 다리가 가려진 친구는, 같은 사진 속 다른 친구들의 키를 보고 발 위치를 짐작한다.
 *   (카메라에서 멀수록 작게 찍히므로 '발이 사진에서 얼마나 아래에 있나'와 '키'가 거의 비례한다)
 * - 발이 무대 영역 밖이면 무대 밖 사람으로 표시한다.
 */
export function refineForStage(
  boxes: PersonBox[],
  corners: readonly Point[] | undefined,
  imgH: number,
): PersonBox[] {
  const occluded = boxes.map((a, i) => isOccluded(a.bbox, boxes, i, imgH))
  const mapper = corners && corners.length === 4 ? createStageMapper(corners) : null
  const isOff = (p: Point) => {
    if (!mapper) return false
    const s = mapper.toStage(p)
    return !(s.x > -0.1 && s.x < 1.1 && s.y > -0.12 && s.y < 1.15)
  }

  // 가려지지 않고 무대 위에 선 사람들로 '발 높이 → 키' 관계를 구한다.
  const fit = fitHeightModel(
    boxes.filter((b, i) => !occluded[i] && !isOff(footPoint(b.bbox))).map((b) => b.bbox),
  )

  return boxes.map((b, i) => {
    const [x, y, w, h] = b.bbox
    let foot: Point = { x: x + w / 2, y: y + h }
    let footEstimated = false
    if (occluded[i] && fit) {
      // 키 = a·발높이 + b, 키 = 발높이 − 머리높이  →  발높이 = (머리높이 + b) / (1 − a)
      const predicted = (y + fit.b) / (1 - fit.a)
      if (Number.isFinite(predicted) && predicted > y + h + h * 0.12) {
        foot = { x: foot.x, y: Math.min(predicted, y + h * 3, imgH * 1.05) }
        footEstimated = true
      }
    }
    return { ...b, foot, footEstimated, offStage: isOff(foot) }
  })
}

/** 이 네모의 아랫부분을 더 앞에 선(아래쪽에 발이 있는) 사람이 가리고 있는지 */
function isOccluded(a: Box, all: PersonBox[], self: number, imgH: number): boolean {
  const [ax, ay, aw, ah] = a
  const aBottom = ay + ah
  // 사진 아래 끝에 닿았으면 다리가 잘렸을 수 있다.
  if (aBottom >= imgH - 2) return true
  return all.some((o, j) => {
    if (j === self) return false
    const [bx, by, bw, bh] = o.bbox
    const bBottom = by + bh
    if (bBottom < aBottom + ah * 0.08) return false // 앞에 선 사람이 아니다
    if (by > aBottom + ah * 0.15) return false // 앞사람이 이 사람 아래쪽에 닿지 않는다
    const overlapX = Math.min(ax + aw, bx + bw) - Math.max(ax, bx)
    return overlapX > aw * 0.3
  })
}

/** 키(h) = a × 발 높이 + b 를 구한다. (튀는 값은 한 번 걸러 내고 다시 구한다) */
function fitHeightModel(list: Box[]): { a: number; b: number } | null {
  const pts = list.map(([, y, , h]) => ({ foot: y + h, h }))
  const solve = (ps: { foot: number; h: number }[]) => {
    if (ps.length < 3) return null
    const n = ps.length
    const mx = ps.reduce((s, p) => s + p.foot, 0) / n
    const my = ps.reduce((s, p) => s + p.h, 0) / n
    let sxx = 0
    let sxy = 0
    for (const p of ps) {
      sxx += (p.foot - mx) ** 2
      sxy += (p.foot - mx) * (p.h - my)
    }
    if (sxx < 1e-6) return null
    const a = sxy / sxx
    return { a, b: my - a * mx }
  }
  let fit = solve(pts)
  if (!fit) return null
  const res = pts.map((p) => Math.abs(p.h - (fit!.a * p.foot + fit!.b)))
  const sortedRes = [...res].sort((x, y) => x - y)
  const cut = sortedRes[Math.floor(sortedRes.length * 0.75)] * 1.5 + 1
  fit = solve(pts.filter((_, i) => res[i] <= cut)) ?? fit
  // 멀리 있을수록 작아야 한다. (반대거나 너무 가파르면 믿지 않는다)
  if (!(fit.a > 0.05 && fit.a < 0.95)) return null
  return fit
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
  const inter = intersection(a, b)
  if (inter === 0) return 0
  return inter / (a[2] * a[3] + b[2] * b[3] - inter)
}

/** a 네모가 b 네모 안에 얼마나 들어가 있는지 (a 넓이 기준 0~1) */
function containment(a: Box, b: Box): number {
  const area = a[2] * a[3]
  return area > 0 ? intersection(a, b) / area : 0
}

function intersection(a: Box, b: Box): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[0] + a[2], b[0] + b[2])
  const y2 = Math.min(a[1] + a[3], b[1] + b[3])
  if (x2 <= x1 || y2 <= y1) return 0
  return (x2 - x1) * (y2 - y1)
}
