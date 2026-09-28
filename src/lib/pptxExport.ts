import { CANVAS_FONT } from './canvasFont'
import { drawStagePlan } from './planCanvas'
import { PRINT_COLORS, cutPlanLayers, formatSec } from './pdfExport'
import { describePosition } from './stageMarks'
import type { Cut, Project, Student } from '../db/types'

/**
 * 컷 하나를 한 장에 크게 넣은 발표용 PPTX를 만든다. (오픈소스 PptxGenJS 사용)
 *
 * - 평면도는 PDF처럼 캔버스에 그려 그림으로 넣는다. (화면과 같은 모양, 글꼴 걱정 없음)
 * - 제목·메모는 글상자로 넣어서 파워포인트·구글 슬라이드에서 바로 고칠 수 있다.
 * - 슬라이드 노트에 배우마다 무대 앞 번호를 적어 두어, 연습 때 말로 알려 주기 좋다.
 */

export interface PptxOptions {
  /** 지나온 길(이전 컷에서 온 길)도 그릴지 */
  showTrails: boolean
  showGrid: boolean
  flipped: boolean
}

/** 16:9 와이드 슬라이드 크기(인치) */
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.5
/** 파워포인트가 없는 컴퓨터에서도 대부분 있는 한글 글꼴 */
const FONT = 'Malgun Gothic'
const INK = '1F2A44'
const SUB = '55607A'
const FAINT = '9AA3B5'

/**
 * 평면도 그림 크기. 선 굵기·글자 크기가 PDF와 같은 비율이 되도록 PDF 칸만 한 크기(가로 880)로 그리고,
 * 슬라이드를 꽉 채워도 흐리지 않게 2배 해상도로 뽑는다.
 */
const PLAN_W = 880
const PLAN_SCALE = 2
const LABEL_FONT = 22

export async function exportCutsToPptx(
  project: Project,
  cuts: Cut[],
  students: Student[],
  options: PptxOptions,
): Promise<Blob> {
  const studentById: Record<string, Student> = {}
  for (const s of students) studentById[s.id] = s

  // 무거운 라이브러리라 PPT를 만들 때만 불러온다. (첫 화면이 가벼워진다)
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = `${project.title} 동선표`
  pptx.company = '동선노트'
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  const viewLabel = options.flipped ? '무대에서 본 모습' : '객석에서 본 모습'
  const stageLabel = `무대 ${project.stageWidthM}m × ${project.stageDepthM}m`

  // ---- 표지 ----
  const cover = pptx.addSlide()
  cover.background = { color: 'EAF3FD' }
  cover.addText(project.title, {
    x: MARGIN, y: 2.3, w: SLIDE_W - MARGIN * 2, h: 1.4,
    fontFace: FONT, fontSize: 48, bold: true, color: INK, align: 'center', valign: 'middle',
  })
  cover.addText(`동선표 · 컷 ${cuts.length}개`, {
    x: MARGIN, y: 3.7, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontFace: FONT, fontSize: 24, color: SUB, align: 'center',
  })
  cover.addText(`${stageLabel} · ${viewLabel} · 배우 ${students.length}명`, {
    x: MARGIN, y: 4.4, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontFace: FONT, fontSize: 16, color: SUB, align: 'center',
  })
  addFooter(cover)

  // ---- 컷마다 한 장 ----
  cuts.forEach((cut, index) => {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }

    slide.addText(`${index + 1}. ${cut.title}`, {
      x: MARGIN, y: 0.3, w: 8.6, h: 0.7,
      fontFace: FONT, fontSize: 28, bold: true, color: INK, valign: 'middle', fit: 'shrink',
    })
    slide.addText(`${stageLabel} · ${viewLabel}\n${index + 1} / ${cuts.length}`, {
      x: SLIDE_W - MARGIN - 3.6, y: 0.3, w: 3.6, h: 0.7,
      fontFace: FONT, fontSize: 12, color: SUB, align: 'right', valign: 'middle',
    })

    // 메모·영상 시각은 제목 아래 한 줄로
    const sub = [cut.memo?.trim(), cut.video ? `영상 ${formatSec(cut.video.timeSec)}` : '']
      .filter(Boolean)
      .join('  ·  ')
    let top = 1.05
    if (sub) {
      slide.addText(sub, {
        x: MARGIN, y: top, w: SLIDE_W - MARGIN * 2, h: 0.5,
        fontFace: FONT, fontSize: 15, color: SUB, valign: 'top', fit: 'shrink',
      })
      top += 0.5
    }

    // 평면도: 남은 자리 안에서 비율을 지키며 가장 크게, 가운데에
    const plan = renderPlanImage(project, cut, cuts[index - 1], studentById, options)
    const boxW = SLIDE_W - MARGIN * 2
    const boxH = SLIDE_H - top - 0.55
    let w = boxW
    let h = (w * plan.height) / plan.width
    if (h > boxH) {
      h = boxH
      w = (h * plan.width) / plan.height
    }
    slide.addImage({
      data: plan.dataUrl.replace(/^data:/, ''),
      x: (SLIDE_W - w) / 2, y: top + (boxH - h) / 2, w, h,
      altText: `${index + 1}번 컷 무대 평면도`,
    })

    addFooter(slide)
    slide.addNotes(cutNotes(cut, studentById))
  })

  function addFooter(slide: ReturnType<typeof pptx.addSlide>) {
    slide.addText('동선노트 · Created by. 교육뮤지컬 꿈꾸는 치수쌤', {
      x: MARGIN, y: SLIDE_H - 0.45, w: SLIDE_W - MARGIN * 2, h: 0.3,
      fontFace: FONT, fontSize: 10, color: FAINT, align: 'center',
    })
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob
}

/** 컷 하나의 평면도를 큰 그림으로 그린다. (무대 뒤·객석 글자와 번호 자리까지 포함) */
function renderPlanImage(
  project: Project,
  cut: Cut,
  previous: Cut | undefined,
  studentById: Record<string, Student>,
  options: PptxOptions,
): { dataUrl: string; width: number; height: number } {
  const planW = PLAN_W
  const planH = Math.round(planW * (project.stageDepthM / project.stageWidthM))
  // 위: '무대 뒤' 글자, 아래: 무대 앞 번호 + '객석' 글자, 옆: 앞뒤 번호가 들어갈 자리
  const padX = 40
  const padTop = 40
  const padBottom = 62
  const width = planW + padX * 2
  const height = planH + padTop + padBottom

  const canvas = document.createElement('canvas')
  canvas.width = width * PLAN_SCALE
  canvas.height = height * PLAN_SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
  ctx.scale(PLAN_SCALE, PLAN_SCALE)

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // 뒤집어 보면 번호가 위로 가므로 위아래 여백을 바꿔 준다.
  const y = options.flipped ? padBottom : padTop
  const { icons, trails } = cutPlanLayers(cut, previous, studentById, options.showTrails)
  drawStagePlan(ctx, {
    rect: { x: padX, y, width: planW, height: planH },
    colors: PRINT_COLORS,
    icons,
    trails,
    showGrid: options.showGrid,
    flipped: options.flipped,
    iconRadius: Math.max(14, planW / 19),
    labelFontSize: LABEL_FONT,
  })

  if (icons.length === 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${LABEL_FONT}px ${CANVAS_FONT}`
    ctx.fillStyle = '#9AA3B5'
    ctx.fillText('아직 이름을 붙이지 않았어요', padX + planW / 2, y + planH / 2)
  }

  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}

/**
 * 슬라이드 노트: 메모와, 배우마다 무대 앞 번호(객석에서 본 번호).
 * PptxGenJS는 노트를 문단 하나로 넣어서 줄바꿈이 프로그램마다 다르게 보이므로 한 줄로 이어 쓴다.
 */
function cutNotes(cut: Cut, studentById: Record<string, Student>): string {
  const parts: string[] = []
  if (cut.memo?.trim()) parts.push(`메모: ${cut.memo.trim()}`)
  const spots = cut.placements
    .flatMap((p) => {
      const s = studentById[p.studentId]
      return s ? [{ s, where: describePosition(p.x) }] : []
    })
    .sort((a, b) => a.s.order - b.s.order)
    .map(({ s, where }) => `${s.name}${s.role ? `(${s.role})` : ''} ${where}`)
  if (spots.length > 0) parts.push(`자리(객석에서 본 무대 앞 번호): ${spots.join(' · ')}`)
  return parts.join('   /   ')
}
