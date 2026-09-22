import { useState } from 'react'
import { Check, Plus, UserX } from 'lucide-react'
import Modal from './Modal'
import type { Student } from '../db/types'
import { textColorOn } from '../lib/colors'

interface Props {
  students: Student[]
  /** 이 컷에 이미 자리를 잡은 학생들 */
  placedIds: Set<string>
  /** 지금 고르고 있는 자리에 붙어 있는 학생 */
  currentId?: string
  /** 지난 컷에서 이 근처에 있던 학생 (추천) */
  suggestedId?: string
  onPick: (studentId: string) => void
  /** 명단에 없는 이름 새로 넣기 */
  onAddNew: (name: string) => void
  /** 사람이 아니에요 → 이 자리 지우기 */
  onRemove: () => void
  onClose: () => void
}

/** 아래에서 올라오는 명단 선택 창 */
export default function NamePickerSheet({
  students,
  placedIds,
  currentId,
  suggestedId,
  onPick,
  onAddNew,
  onRemove,
  onClose,
}: Props) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // 추천 학생을 맨 앞으로
  const sorted = [...students].sort((a, b) => {
    if (a.id === suggestedId) return -1
    if (b.id === suggestedId) return 1
    return a.order - b.order
  })

  return (
    <Modal title="누구인가요?" onClose={onClose} wide>
      <p className="hint">이름을 누르면 이 자리에 붙어요. 이미 넣은 친구는 흐리게 보여요.</p>

      <div className="picker-grid">
        {sorted.map((s) => {
          const placed = placedIds.has(s.id) && s.id !== currentId
          const isCurrent = s.id === currentId
          return (
            <button
              key={s.id}
              type="button"
              className={`picker-chip${isCurrent ? ' is-current' : ''}`}
              style={{
                background: s.color,
                color: textColorOn(s.color),
                opacity: placed ? 0.4 : 1,
              }}
              onClick={() => onPick(s.id)}
            >
              <span className="picker-name">{s.name}</span>
              {placed && <Check size={18} aria-hidden="true" />}
              {s.id === suggestedId && !placed && <span className="picker-tip">지난 컷 자리</span>}
            </button>
          )
        })}
      </div>

      {adding ? (
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            onAddNew(newName.trim())
            setNewName('')
            setAdding(false)
          }}
        >
          <div className="field add-field">
            <label htmlFor="new-name">새 이름</label>
            <input
              id="new-name"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예) 이송내"
              autoFocus
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            넣기
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>
          <Plus size={22} aria-hidden="true" />
          명단에 없는 이름 추가
        </button>
      )}

      <button type="button" className="btn btn-danger btn-block" onClick={onRemove}>
        <UserX size={22} aria-hidden="true" />
        사람 아니에요 (이 표시 지우기)
      </button>
    </Modal>
  )
}
