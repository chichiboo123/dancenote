import { useEffect, useMemo, useRef, useState } from 'react'
import { GripHorizontal, ImageOff, MapPin, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { deleteCut, reorderCuts, updateCut } from '../db/repo'
import type { Cut } from '../db/types'

const ITEM_WIDTH = 172
const GAP = 12

interface Props {
  projectId: string
  cuts: Cut[]
  /** 지금 보고 있는 컷 */
  activeId?: string
  onSelect?: (cut: Cut) => void
  /** 컷을 누르면 갈 주소를 만드는 함수 (없으면 onSelect만 부른다) */
  onOpen?: (cut: Cut) => void
}

/** 필름처럼 늘어놓은 컷 목록. 끌어서 순서를 바꿀 수 있다. */
export default function CutTimeline({ projectId, cuts, activeId, onSelect, onOpen }: Props) {
  const [dragging, setDragging] = useState<{ id: string; from: number; to: number; dx: number } | null>(
    null,
  )
  const [editing, setEditing] = useState<Cut | null>(null)
  const [toDelete, setToDelete] = useState<Cut | null>(null)
  const startRef = useRef({ x: 0, index: 0 })

  // 끌고 있는 동안 보여 줄 임시 순서
  const shown = useMemo(() => {
    if (!dragging) return cuts
    const next = [...cuts]
    const [moved] = next.splice(dragging.from, 1)
    next.splice(dragging.to, 0, moved)
    return next
  }, [cuts, dragging])

  function handlePointerDown(e: React.PointerEvent, index: number, cut: Cut) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    startRef.current = { x: e.clientX, index }
    setDragging({ id: cut.id, from: index, to: index, dx: 0 })
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - startRef.current.x
    const steps = Math.round(dx / (ITEM_WIDTH + GAP))
    const to = Math.min(cuts.length - 1, Math.max(0, startRef.current.index + steps))
    setDragging((prev) => (prev ? { ...prev, to, dx } : prev))
  }

  async function handlePointerUp() {
    if (!dragging) return
    const { from, to, dx } = dragging
    setDragging(null)
    if (from === to) {
      // 거의 움직이지 않았으면 '누르기'로 본다.
      if (Math.abs(dx) < 8) {
        const cut = cuts[from]
        if (cut) (onOpen ?? onSelect)?.(cut)
      }
      return
    }
    const next = [...cuts]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    await reorderCuts(
      projectId,
      next.map((c) => c.id),
    )
    toast.success('컷 순서를 바꿨어요.')
  }

  return (
    <section className="timeline-wrap">
      <div className="timeline-head">
        <h2 className="section-title">기록한 컷 {cuts.length}개</h2>
        <span className="hint">
          <GripHorizontal size={16} aria-hidden="true" /> 끌어서 순서를 바꿔요
        </span>
      </div>

      <ol className="timeline">
        {shown.map((cut, index) => (
          <li
            key={cut.id}
            className={`timeline-item${dragging?.id === cut.id ? ' is-dragging' : ''}${
              activeId === cut.id ? ' is-active' : ''
            }`}
          >
            <button
              type="button"
              className="timeline-card"
              onPointerDown={(e) => handlePointerDown(e, index, cut)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setDragging(null)}
              aria-label={`${cut.title} 열기`}
            >
              <span className="timeline-no">{index + 1}</span>
              <CutImage cut={cut} />
              <span className="timeline-title">{cut.title}</span>
              <span className="timeline-meta">
                {cut.placements.length > 0 ? (
                  <>
                    <Users size={14} aria-hidden="true" /> {cut.placements.length}명
                  </>
                ) : cut.stageCorners ? (
                  <>
                    <MapPin size={14} aria-hidden="true" /> 이름을 붙여요
                  </>
                ) : (
                  '무대 영역을 정해요'
                )}
              </span>
              {cut.memo && <span className="timeline-memo">{cut.memo}</span>}
            </button>

            <div className="timeline-actions">
              <button
                type="button"
                className="btn btn-quiet btn-icon"
                onClick={() => setEditing(cut)}
                aria-label={`${cut.title} 제목과 메모 고치기`}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-icon"
                onClick={() => setToDelete(cut)}
                aria-label={`${cut.title} 지우기`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>

      {editing && (
        <CutEditor
          cut={editing}
          onClose={() => setEditing(null)}
          onSave={async (title, memo) => {
            await updateCut(editing.id, { title, memo })
            setEditing(null)
            toast.success('컷 정보를 저장했어요.')
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="이 컷을 지울까요?"
          message={`'${toDelete.title}'의 사진과 동선이 사라져요.`}
          onConfirm={async () => {
            await deleteCut(toDelete.id)
            await reorderCuts(
              projectId,
              cuts.filter((c) => c.id !== toDelete.id).map((c) => c.id),
            )
            setToDelete(null)
            toast.success('컷을 지웠어요.')
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  )
}

/** 컷 제목과 메모 고치기 */
function CutEditor({
  cut,
  onClose,
  onSave,
}: {
  cut: Cut
  onClose: () => void
  onSave: (title: string, memo: string) => void
}) {
  const [title, setTitle] = useState(cut.title)
  const [memo, setMemo] = useState(cut.memo)

  return (
    <Modal title="컷 제목과 메모" onClose={onClose}>
      <div className="field">
        <label htmlFor="cut-title">컷 제목</label>
        <input
          id="cut-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) M3 시작, 2절 후렴"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="cut-memo">메모 (안 써도 돼요)</label>
        <textarea
          id="cut-memo"
          className="textarea"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예) 주인공이 가운데로 걸어 나옴"
        />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => onSave(title.trim() || cut.title, memo.trim())}
      >
        저장하기
      </button>
    </Modal>
  )
}

function CutImage({ cut }: { cut: Cut }) {
  const url = useMemo(
    () => (cut.imageBlob ? URL.createObjectURL(cut.imageBlob) : null),
    [cut.imageBlob],
  )

  // 화면에서 사라질 때 메모리를 돌려준다.
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  if (!url) {
    return (
      <span className="timeline-img timeline-img-empty">
        <ImageOff size={24} aria-hidden="true" />
      </span>
    )
  }
  return <img className="timeline-img" src={url} alt="" draggable={false} />
}
