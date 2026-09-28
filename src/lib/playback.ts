import type { TrailMode } from '../store/viewPrefs'
import type { Cut, Student } from '../db/types'

/**
 * 동선 재생의 "지금 이 순간" 계산.
 * 화면(동선 재생), 동선 영상, PDF·PPT가 모두 같은 계산을 써서 보이는 모습이 똑같다.
 * progress는 0(첫 컷) ~ 컷 수 - 1(마지막 컷) 사이의 실수다. 2.5면 3번 컷과 4번 컷의 한가운데.
 */

export interface PlayMark {
  id: string
  x: number
  y: number
  color: string
  label: string
  emoji?: string
  /** 컷 사이에서 나타나거나 사라지는 중 */
  opacity: number
  /** 한 배우만 따라갈 때 나머지 배우 */
  faded: boolean
}

export interface PlayTrail {
  id: string
  color: string
  points: { x: number; y: number }[]
}

/** 0 ~ 마지막 컷 사이로 맞춘다. NaN이 들어와도 0이 된다. */
export function clampIndex(value: number, lastIndex: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(lastIndex, Math.max(0, value))
}

/** 시작과 끝을 부드럽게 (가속 → 감속) */
export function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** 지금 이 순간 배우들이 서 있는 자리 */
export function marksAt(
  cuts: Cut[],
  studentById: Record<string, Student>,
  progress: number,
  focusId: string | null = null,
): PlayMark[] {
  if (cuts.length === 0) return []
  const lastIndex = cuts.length - 1
  // 컷이 지워지는 순간 등 어떤 경우에도 없는 컷을 읽지 않도록 범위를 좁힌다.
  const i = clampIndex(Math.floor(progress), lastIndex)
  const f = ease(Math.min(1, Math.max(0, progress - i)))
  const a = cuts[i] ?? cuts[0]
  const b = cuts[clampIndex(i + 1, lastIndex)] ?? a

  const ids = new Set<string>([
    ...a.placements.map((p) => p.studentId),
    ...b.placements.map((p) => p.studentId),
  ])

  const list: PlayMark[] = []
  for (const studentId of ids) {
    const student = studentById[studentId]
    if (!student) continue
    const pa = a.placements.find((p) => p.studentId === studentId)
    const pb = b.placements.find((p) => p.studentId === studentId)

    let x: number
    let y: number
    let opacity = 1
    if (pa && pb) {
      x = pa.x + (pb.x - pa.x) * f
      y = pa.y + (pb.y - pa.y) * f
    } else if (pa) {
      x = pa.x
      y = pa.y
      opacity = 1 - f // 다음 컷에 없으면 스르르 사라진다
    } else {
      x = pb!.x
      y = pb!.y
      opacity = f // 다음 컷에서 새로 나타난다
    }

    list.push({
      id: studentId,
      x,
      y,
      color: student.color,
      label: student.shortName,
      emoji: student.emoji,
      opacity,
      faded: Boolean(focusId) && focusId !== studentId,
    })
  }
  return list
}

/**
 * 지나온 길
 * - '직전 컷만': 컷 사이를 지나는 중이면 떠난 컷 → 지금 자리, 컷에 멈춰 있으면 바로 앞 컷 → 이 컷
 * - '처음부터 전체': 첫 컷부터 지금 자리까지 전부
 * - 한 배우만 따라가는 중이면 그 배우의 길만 그린다.
 */
export function trailsAt(
  cuts: Cut[],
  students: Student[],
  progress: number,
  marks: PlayMark[],
  options: { trailMode: TrailMode; focusId?: string | null },
): PlayTrail[] {
  if (cuts.length < 2) return []
  const lastIndex = cuts.length - 1
  const upto = clampIndex(Math.floor(progress), lastIndex)
  const resting = progress - upto < 0.001
  const from = options.trailMode === 'all' ? 0 : resting ? Math.max(0, upto - 1) : upto
  const shown = options.focusId ? students.filter((s) => s.id === options.focusId) : students
  return shown.flatMap((student) => {
    const points: { x: number; y: number }[] = []
    for (let i = from; i <= upto; i++) {
      const p = cuts[i]?.placements.find((pl) => pl.studentId === student.id)
      if (p) points.push({ x: p.x, y: p.y })
    }
    const now = marks.find((m) => m.id === student.id)
    if (now) points.push({ x: now.x, y: now.y })
    if (points.length < 2) return []
    return [{ id: student.id, color: student.color, points }]
  })
}
