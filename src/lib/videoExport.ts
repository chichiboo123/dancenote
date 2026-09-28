import { CANVAS_FONT } from './canvasFont'
import { drawStagePlan } from './planCanvas'
import { PRINT_COLORS } from './pdfExport'
import { clampIndex, marksAt, trailsAt } from './playback'
import type { TrailMode } from '../store/viewPrefs'
import type { Cut, Project, Student } from '../db/types'

/**
 * 동선 재생을 영상(MP4)으로 만든다. (오픈소스 Mediabunny + 브라우저 내장 WebCodecs)
 *
 * 화면을 실시간으로 녹화(MediaRecorder)하면 영상 길이만큼 기다려야 하고 WebM으로 나와
 * PPT·휴대폰에서 안 열리는 경우가 많다. 그래서 한 장면씩 캔버스에 그려 바로 인코딩한다.
 * 실제 재생 시간보다 훨씬 빨리 끝나고, 어디서나 열리는 H.264 MP4가 된다.
 */

export interface VideoOptions {
  /** 컷 하나가 다음 컷으로 옮겨 가는 데 걸리는 시간(초) — 화면의 재생 속도와 같다 */
  secondsPerCut: number
  showTrails: boolean
  trailMode: TrailMode
  showGrid: boolean
  flipped: boolean
  markScale: number
  /** 한 배우만 따라가는 중이면 그 배우 */
  focusId: string | null
  /** 0~1 진행률 */
  onProgress?: (ratio: number) => void
}

export interface VideoResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  mimeType: string
}

/** 16:9 HD. 태블릿·TV·PPT 어디에 띄워도 선명하고 파일도 작다. */
const W = 1280
const H = 720
const FPS = 30
/** 처음과 끝에서 잠깐 멈춰 두는 시간(초) — 첫 자리와 마지막 자리를 볼 수 있게 */
const HOLD_START = 1
const HOLD_END = 1.5
const HEADER_H = 76
const FOOTER_H = 34

/** 이 브라우저에서 동선 영상을 만들 수 있는지 (WebCodecs가 있어야 한다) */
export function canMakeVideo(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

export async function exportPlaybackVideo(
  project: Project,
  cuts: Cut[],
  students: Student[],
  options: VideoOptions,
): Promise<VideoResult> {
  if (cuts.length < 2) throw new Error('컷이 두 개 이상이어야 해요.')

  // 무거운 라이브러리라 영상을 만들 때만 불러온다.
  const {
    Output,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    WebMOutputFormat,
    QUALITY_HIGH,
    canEncodeVideo,
  } = await import('mediabunny')

  // 어디서나 열리는 H.264(MP4)를 먼저, 안 되면 VP9·VP8(WebM)
  let codec: 'avc' | 'vp9' | 'vp8' | null = null
  for (const c of ['avc', 'vp9', 'vp8'] as const) {
    if (await canEncodeVideo(c, { width: W, height: H, quality: QUALITY_HIGH })) {
      codec = c
      break
    }
  }
  if (!codec) throw new Error('이 브라우저에서는 영상을 만들 수 없어요.')
  const isMp4 = codec === 'avc'

  const studentById: Record<string, Student> = {}
  for (const s of students) studentById[s.id] = s

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.')

  const output = new Output({
    format: isMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  })
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH })
  output.addVideoTrack(source, { frameRate: FPS })
  await output.start()

  const lastIndex = cuts.length - 1
  const moveSeconds = lastIndex * options.secondsPerCut
  const total = HOLD_START + moveSeconds + HOLD_END
  const frames = Math.ceil(total * FPS)

  for (let f = 0; f < frames; f++) {
    const t = f / FPS
    const progress = clampIndex((t - HOLD_START) / options.secondsPerCut, lastIndex)
    drawFrame(ctx, project, cuts, students, studentById, progress, options)
    await source.add(t, 1 / FPS)
    if (f % 10 === 0) options.onProgress?.(f / frames)
  }

  await output.finalize()
  options.onProgress?.(1)
  const buffer = output.target.buffer
  if (!buffer) throw new Error('영상을 만들지 못했어요.')
  const mimeType = isMp4 ? 'video/mp4' : 'video/webm'
  return { blob: new Blob([buffer], { type: mimeType }), extension: isMp4 ? 'mp4' : 'webm', mimeType }
}

/** 한 장면 그리기: 위에 공연·컷 제목, 가운데 평면도, 아래 작은 꼬리말 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  cuts: Cut[],
  students: Student[],
  studentById: Record<string, Student>,
  progress: number,
  options: VideoOptions,
) {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // 머리글: 지금 보이는 컷 (화면의 안내 띠와 같게, 가까운 컷 기준)
  const lastIndex = cuts.length - 1
  const shown = clampIndex(Math.round(progress), lastIndex)
  const cut = cuts[shown]
  const cutLabel =
    cut.title === `컷 ${shown + 1}` ? `${shown + 1}번 컷` : `${shown + 1}번 컷 · ${cut.title}`

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1F2A44'
  ctx.font = `700 30px ${CANVAS_FONT}`
  ctx.fillText(fitText(ctx, cutLabel, W - 420), 40, HEADER_H / 2 + 4)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#55607A'
  ctx.font = `20px ${CANVAS_FONT}`
  ctx.fillText(fitText(ctx, project.title, 340), W - 40, HEADER_H / 2 - 10)
  ctx.font = `700 18px ${CANVAS_FONT}`
  ctx.fillText(`${shown + 1} / ${cuts.length}`, W - 40, HEADER_H / 2 + 16)

  // 진행 막대
  ctx.fillStyle = '#E6EAF1'
  ctx.fillRect(40, HEADER_H - 4, W - 80, 4)
  ctx.fillStyle = '#006DD2'
  ctx.fillRect(40, HEADER_H - 4, ((W - 80) * progress) / Math.max(1, lastIndex), 4)

  // 평면도: 남은 자리 안에서 무대 비율을 지키며 가장 크게
  const labelFont = 22
  const padTop = 38
  const padBottom = 58
  const padX = 40
  const areaTop = HEADER_H + 8
  const areaH = H - areaTop - FOOTER_H
  const ratio = project.stageDepthM / project.stageWidthM
  let planW = W - padX * 2 - 40
  let planH = planW * ratio
  if (planH > areaH - padTop - padBottom) {
    planH = areaH - padTop - padBottom
    planW = planH / ratio
  }
  const planX = (W - planW) / 2
  const planY = areaTop + (options.flipped ? padBottom : padTop) + (areaH - padTop - padBottom - planH) / 2

  const marks = marksAt(cuts, studentById, progress, options.focusId)
  const trails = options.showTrails
    ? trailsAt(cuts, students, progress, marks, {
        trailMode: options.trailMode,
        focusId: options.focusId,
      })
    : []

  drawStagePlan(ctx, {
    rect: { x: planX, y: planY, width: planW, height: planH },
    colors: PRINT_COLORS,
    icons: marks,
    trails,
    showGrid: options.showGrid,
    flipped: options.flipped,
    markScale: options.markScale,
    labelFontSize: labelFont,
  })

  // 꼬리말
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `14px ${CANVAS_FONT}`
  ctx.fillStyle = '#9AA3B5'
  ctx.fillText('동선노트 · Created by. 교육뮤지컬 꿈꾸는 치수쌤', W / 2, H - FOOTER_H / 2)
}

/** 칸보다 긴 글은 끝을 … 로 줄인다. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}
