import type { Student } from '../db/types'
import { textColorOn } from '../lib/colors'

/** 명단에 보이는 학생 칩 (색 + 이름 + 배역) */
export default function StudentChip({
  student,
  onClick,
  dimmed = false,
}: {
  student: Student
  onClick?: (student: Student) => void
  dimmed?: boolean
}) {
  const fg = textColorOn(student.color)
  return (
    <button
      type="button"
      className="chip"
      style={{ background: student.color, color: fg, opacity: dimmed ? 0.45 : 1 }}
      onClick={() => onClick?.(student)}
      aria-label={`${student.name}${student.role ? ` (${student.role})` : ''} 고치기`}
    >
      <span className="chip-name">{student.name}</span>
      {student.role && <span className="chip-role">{student.role}</span>}
    </button>
  )
}
