import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPaste, Plus, Trash2, Undo2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import StudentChip from '../components/StudentChip'
import { db } from '../db/db'
import { addStudents, deleteStudent, restoreStudent, updateStudent } from '../db/repo'
import { PALETTE, textColorOn } from '../lib/colors'
import { makeShortName, parseNameList } from '../lib/names'
import type { Student } from '../db/types'

/** 되돌리기 한 칸 */
interface UndoStep {
  label: string
  run: () => Promise<void>
}

export default function RosterPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [editing, setEditing] = useState<Student | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null)
  const [undoStack, setUndoStack] = useState<UndoStep[]>([])

  const project = useLiveQuery(() => db.projects.get(id), [id])
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(id).sortBy('order'),
    [id],
    [],
  )

  function pushUndo(step: UndoStep) {
    setUndoStack((prev) => [...prev.slice(-19), step])
  }

  async function handleUndo() {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    await last.run()
    setUndoStack((prev) => prev.slice(0, -1))
    toast.success(`되돌렸어요: ${last.label}`)
  }

  async function addNames(names: string[], source: string) {
    const created = await addStudents(id, names)
    if (created.length === 0) {
      toast.error('넣을 이름이 없어요.')
      return
    }
    pushUndo({
      label: `${source} ${created.length}명 넣기`,
      run: async () => {
        await db.students.bulkDelete(created.map((s) => s.id))
      },
    })
    toast.success(`${created.length}명을 명단에 넣었어요!`)
  }

  async function handleAddOne(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await addNames([trimmed], '이름')
    setName('')
    inputRef.current?.focus()
  }

  async function handlePaste() {
    const names = parseNameList(pasteText)
    if (names.length === 0) {
      toast.error('이름을 찾지 못했어요. 한 줄에 한 명씩 붙여넣어 주세요.')
      return
    }
    await addNames(names, '붙여넣기로')
    setPasteText('')
    setPasteOpen(false)
  }

  async function handleSaveEdit(patch: Partial<Student>) {
    if (!editing) return
    const before = editing
    await updateStudent(before.id, patch)
    pushUndo({
      label: `${before.name} 고치기`,
      run: async () => {
        await updateStudent(before.id, {
          name: before.name,
          shortName: before.shortName,
          role: before.role,
          color: before.color,
        })
      },
    })
    setEditing(null)
    toast.success('고쳤어요.')
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const gone = confirmDelete
    await deleteStudent(gone.id)
    pushUndo({
      label: `${gone.name} 지우기`,
      run: async () => {
        await restoreStudent(gone)
      },
    })
    setConfirmDelete(null)
    setEditing(null)
    toast.success(`${gone.name}을(를) 지웠어요. 되돌리기로 되살릴 수 있어요.`)
  }

  const pasteCount = parseNameList(pasteText).length

  return (
    <>
      <AppHeader
        backTo={`/project/${id}`}
        title="친구 명단"
        help={{
          title: '명단은 이렇게 넣어요',
          body: (
            <>
              <p>
                한 명씩 넣으려면 위 칸에 이름을 적고 <strong>넣기</strong>를 눌러요.
              </p>
              <p>
                여러 명을 한 번에 넣으려면 <strong>여러 명 붙여넣기</strong>를 눌러, 이름을 한 줄에
                한 명씩 붙여넣어요.
              </p>
              <p>이름마다 색이 자동으로 정해져요. 칩을 누르면 색과 배역을 바꿀 수 있어요.</p>
            </>
          ),
        }}
      />

      <main className="app-main">
        <ol className="steps">
          <li className="done">
            <span className="step-no">1</span> 공연 만들기
          </li>
          <li aria-current="step">
            <span className="step-no">2</span> 명단 넣기
          </li>
          <li>
            <span className="step-no">3</span> 컷 기록하기
          </li>
        </ol>

        <form className="card add-row" onSubmit={handleAddOne}>
          <div className="field add-field">
            <label htmlFor="student-name">친구 이름</label>
            <input
              id="student-name"
              ref={inputRef}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 김서준"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus size={24} aria-hidden="true" />
            넣기
          </button>
        </form>

        <div className="toolbar">
          <button type="button" className="btn btn-ghost" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste size={22} aria-hidden="true" />
            여러 명 붙여넣기
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo2 size={22} aria-hidden="true" />
            되돌리기
          </button>
        </div>

        {students.length === 0 ? (
          <div className="empty">
            <UserPlus size={48} aria-hidden="true" />
            <p>아직 친구가 없어요.</p>
            <p>위 칸에 이름을 적고 &lsquo;넣기&rsquo;를 눌러 보세요.</p>
          </div>
        ) : (
          <>
            <h2 className="section-title">{students.length}명</h2>
            <div className="chip-grid">
              {students.map((s) => (
                <StudentChip key={s.id} student={s} onClick={setEditing} />
              ))}
            </div>
          </>
        )}

        {students.length > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-big btn-block next-btn"
            onClick={() => navigate(`/project/${id}`)}
          >
            명단 다 넣었어요
          </button>
        )}

        {project && !project.keepPhotos && (
          <p className="hint privacy-line">
            이 공연은 사진을 저장하지 않고 자리만 남기도록 설정되어 있어요.
          </p>
        )}
      </main>

      {pasteOpen && (
        <Modal title="여러 명 붙여넣기" onClose={() => setPasteOpen(false)} wide>
          <p className="hint">
            엑셀이나 한글에서 이름을 복사해 붙여넣어요. 한 줄에 한 명씩이면 가장 좋아요.
          </p>
          <textarea
            className="textarea"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'김서준\n이하윤\n박지호'}
            aria-label="이름 목록"
          />
          <p className="paste-count">찾은 이름: {pasteCount}명</p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
              그만두기
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePaste}
              disabled={pasteCount === 0}
            >
              {pasteCount}명 넣기
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <StudentEditor
          student={editing}
          othersShortNames={students.filter((s) => s.id !== editing.id).map((s) => s.shortName)}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          onDelete={() => setConfirmDelete(editing)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 친구를 명단에서 뺄까요?"
          message={`${confirmDelete.name}을(를) 명단에서 빼요. 되돌리기 버튼으로 되살릴 수 있어요.`}
          confirmLabel="네, 뺄래요"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}

/** 학생 한 명 고치기 (이름 · 배역 · 색) */
function StudentEditor({
  student,
  othersShortNames,
  onClose,
  onSave,
  onDelete,
}: {
  student: Student
  othersShortNames: string[]
  onClose: () => void
  onSave: (patch: Partial<Student>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(student.name)
  const [role, setRole] = useState(student.role ?? '')
  const [color, setColor] = useState(student.color)

  const shortName = makeShortName(name, othersShortNames)

  return (
    <Modal title={`${student.name} 고치기`} onClose={onClose} wide>
      <div className="editor-preview">
        <span
          className="icon-sticker"
          style={{ background: color, color: textColorOn(color) }}
          aria-hidden="true"
        >
          {shortName}
        </span>
        <span className="hint">평면도에는 이렇게 보여요</span>
      </div>

      <div className="field">
        <label htmlFor="edit-name">이름</label>
        <input
          id="edit-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="edit-role">배역 (안 써도 돼요)</label>
        <input
          id="edit-role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예) 주인공, 나무1"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <span className="field-label">색 고르기</span>
        <div className="color-grid" role="group" aria-label="아이콘 색 고르기">
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`color-dot${color === c.hex ? ' is-on' : ''}`}
              style={{ background: c.hex }}
              onClick={() => setColor(c.hex)}
              aria-label={c.label}
              aria-pressed={color === c.hex}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="editor-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          <Trash2 size={22} aria-hidden="true" />
          명단에서 빼기
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            onSave({
              name: name.trim() || student.name,
              shortName,
              role: role.trim() || undefined,
              color,
            })
          }
        >
          저장하기
        </button>
      </div>
    </Modal>
  )
}
