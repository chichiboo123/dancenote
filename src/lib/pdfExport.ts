import { drawStagePlan, type PlanIcon, type PlanTrail } from './planCanvas'
import type { PlanColors } from './planColors'
import type { Cut, Project, Student } from '../db/types'

/**
 * 컷 여러 개를 한 장에 모아 놓은 동선표 PDF를 만든다.
 *
 * 한글 글자를 PDF에 직접 넣으려면 글꼴 파일을 통째로 넣어야 해서 파일이 아주 커진다.
 * 그래서 각 페이지를 캔버스에 그려서 그림으로 넣는다. (화면에 보이는 글꼴 그대로 나온다)
 */

/** A4 가로, 약 150dpi */
const PAGE_W = 1754
const PAGE_H = 1240
const MARGIN = 60
/** 칸마다 제목·메모가 차지하는 높이 (내용이 짧아도 같은 높이를 쓴다) */
const HEADER_H = 86

/** 밝은 무대 색으로 고정한다. (종이에 인쇄할 것이므로) */
const PRINT_COLORS: PlanColors = {
  bg: '#FFFFFF',
  floor: '#F6E6CC',
  plank: '#DFC49B',
  tape: '#B5793F',
  border: '#9C7B4C',
  label: '#55607A',
}

export interface PdfOptions {
  /** 한 장에 몇 컷을 넣을지 (4 또는 6) */
  perPage: 4 | 6
  /** 지나온 길(이전 컷에서 온 길)도 그릴지 */
  showTrails: boolean
  showGrid: boolean
  flipped: boolean
}

export async function exportCutsToPdf(
  project: Project,
  cuts: Cut[],
  students: Student[],
  options: PdfOptions,
): Promise<Blob> {
  const studentById: Record<string, Student> = {}
  for (const s of students) studentById[s.id] = s

  const cols = options.perPage === 4 ? 2 : 3
  const rows = 2
  const pages = Math.max(1, Math.ceil(cuts.length / options.perPage))

  // 무거운 라이브러리라 PDF를 만들 때만 불러온다. (첫 화면이 가벼워진다)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [PAGE_W, PAGE_H] })

  for (let page = 0; page < pages; page++) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W
    canvas.height = PAGE_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 만들 수 없어요.')

    // 종이 바탕
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    // 머리글
    ctx.fillStyle = '#1F2A44'
    ctx.font = '40px Jua, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${project.title} — 동선표`, MARGIN, MARGIN - 20)

    ctx.font = '22px "Gowun Dodum", sans-serif'
    ctx.fillStyle = '#55607A'
    ctx.textAlign = 'right'
    ctx.fillText(
      `무대 ${project.stageWidthM}m × ${project.stageDepthM}m · ${page + 1} / ${pages}쪽 · ` +
        `${options.flipped ? '무대에서 본 모습' : '객석에서 본 모습'}`,
      PAGE_W - MARGIN,
      MARGIN - 14,
    )

    const gridTop = MARGIN + 50
    const gridH = PAGE_H - gridTop - MARGIN
    const cellW = (PAGE_W - MARGIN * 2) / cols
    const cellH = gridH / rows

    for (let i = 0; i < options.perPage; i++) {
      const cutIndex = page * options.perPage + i
      const cut = cuts[cutIndex]
      if (!cut) break

      const col = i % cols
      const row = Math.floor(i / cols)
      const cellX = MARGIN + col * cellW
      const cellY = gridTop + row * cellH

      drawCutCard(ctx, {
        cut,
        cutNumber: cutIndex + 1,
        previous: cuts[cutIndex - 1],
        studentById,
        rect: { x: cellX + 12, y: cellY + 12, width: cellW - 24, height: cellH - 24 },
        stageRatio: project.stageDepthM / project.stageWidthM,
        options,
      })
    }

    // 꼬리말
    ctx.textAlign = 'center'
    ctx.font = '18px "Gowun Dodum", sans-serif'
    ctx.fillStyle = '#9AA3B5'
    ctx.fillText('동선노트 · Created by. 교육뮤지컬 꿈꾸는 치수쌤', PAGE_W / 2, PAGE_H - 34)

    if (page > 0) pdf.addPage([PAGE_W, PAGE_H], 'landscape')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H)
  }

  return pdf.output('blob')
}

function drawCutCard(
  ctx: CanvasRenderingContext2D,
  args: {
    cut: Cut
    cutNumber: number
    previous?: Cut
    studentById: Record<string, Student>
    rect: { x: number; y: number; width: number; height: number }
    /** 무대 세로/가로 비율 */
    stageRatio: number
    options: PdfOptions
  },
) {
  const { cut, cutNumber, previous, studentById, rect, stageRatio, options } = args

  // 제목 줄
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#1F2A44'
  ctx.font = '26px Jua, sans-serif'
  ctx.fillText(`${cutNumber}. ${cut.title}`, rect.x, rect.y)

  // 제목·메모 자리는 칸마다 같은 높이로 잡아, 평면도들이 나란히 보이게 한다.
  let textY = rect.y + 34
  if (cut.memo) {
    ctx.font = '19px "Gowun Dodum", sans-serif'
    ctx.fillStyle = '#55607A'
    textY = wrapText(ctx, cut.memo, rect.x, textY, rect.width, 24, 2)
  }
  if (cut.video) {
    ctx.font = '17px "Gowun Dodum", sans-serif'
    ctx.fillStyle = '#9AA3B5'
    ctx.fillText(`영상 ${formatSec(cut.video.timeSec)}`, rect.x, textY)
  }

  // 평면도는 남은 자리 안에서 무대 비율을 지키며 최대한 크게.
  // 위·아래 '무대 뒤 / 객석' 라벨이 들어갈 자리를 남겨 둔다.
  const LABEL_SPACE = 30
  const planTop = rect.y + HEADER_H + LABEL_SPACE
  const availW = rect.width
  const availH = Math.max(60, rect.y + rect.height - planTop - LABEL_SPACE)
  const planRatio = stageRatio // 무대 비율 그대로
  let planW = availW
  let planH = planW * planRatio
  if (planH > availH) {
    planH = availH
    planW = planH / planRatio
  }
  const planX = rect.x + (availW - planW) / 2
  const planY = planTop

  const icons: PlanIcon[] = cut.placements.flatMap((p) => {
    const student = studentById[p.studentId]
    if (!student) return []
    return [{ x: p.x, y: p.y, color: student.color, label: student.shortName }]
  })

  const trails: PlanTrail[] = options.showTrails && previous
    ? cut.placements.flatMap((p) => {
        const student = studentById[p.studentId]
        const before = previous.placements.find((q) => q.studentId === p.studentId)
        if (!student || !before) return []
        return [{ color: student.color, points: [{ x: before.x, y: before.y }, { x: p.x, y: p.y }] }]
      })
    : []

  drawStagePlan(ctx, {
    rect: { x: planX, y: planY, width: planW, height: planH },
    colors: PRINT_COLORS,
    icons,
    trails,
    showGrid: options.showGrid,
    flipped: options.flipped,
    iconRadius: Math.max(13, planW / 17),
    labelFontSize: 21,
  })

  if (icons.length === 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '20px "Gowun Dodum", sans-serif'
    ctx.fillStyle = '#9AA3B5'
    ctx.fillText('아직 이름을 붙이지 않았어요', planX + planW / 2, planY + planH / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
  }
}

/** 긴 글을 칸 너비에 맞춰 줄바꿈한다. 다음 글이 시작될 y를 돌려준다. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/)
  let line = ''
  let lines = 0
  let cursorY = y

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines += 1
      if (lines >= maxLines) {
        ctx.fillText(`${line}…`, x, cursorY)
        return cursorY + lineHeight
      }
      ctx.fillText(line, x, cursorY)
      cursorY += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY)
    cursorY += lineHeight
  }
  return cursorY
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
