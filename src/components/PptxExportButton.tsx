import { useState } from 'react'
import { Presentation } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { db } from '../db/db'
import { downloadFile, safeFileName } from '../lib/backup'
import { exportCutsToPptx } from '../lib/pptxExport'
import { MARK_SIZE_LABELS, MARK_SIZE_SCALE, TRAIL_MODE_LABELS, useViewPrefs } from '../store/viewPrefs'

const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** 컷 하나를 한 장씩 담은 발표용 PPTX로 내보내기 */
export default function PptxExportButton({
  projectId,
  className = 'btn btn-ghost',
  label = '발표용 PPT',
  disabled = false,
}: {
  projectId: string
  className?: string
  label?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const prefs = useViewPrefs()

  async function handleExport() {
    setBusy(true)
    try {
      const project = await db.projects.get(projectId)
      if (!project) throw new Error('공연을 찾을 수 없어요.')
      const cuts = await db.cuts.where('projectId').equals(projectId).sortBy('order')
      const students = await db.students.where('projectId').equals(projectId).sortBy('order')
      if (cuts.length === 0) {
        toast.error('먼저 컷을 기록해 주세요.')
        return
      }

      const blob = await exportCutsToPptx(project, cuts, students, {
        showTrails: prefs.showTrails,
        trailMode: prefs.trailMode,
        showGrid: prefs.showGrid,
        flipped: prefs.flipped,
        markScale: MARK_SIZE_SCALE[prefs.markSize],
      })
      const fileName = safeFileName('dongseon-slides', 'pptx')
      downloadFile(blob, fileName, PPTX_TYPE)
      toast.success(`발표 자료를 저장했어요! (${fileName})`)
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('발표 자료를 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="컷 하나를 한 장씩 크게 담은 PPT"
      >
        <Presentation size={20} aria-hidden="true" />
        {label}
      </button>

      {open && (
        <Modal title="발표용 PPT로 저장" onClose={() => setOpen(false)}>
          <p className="hint">
            첫 장은 표지, 그다음부터 <strong>한 장에 컷 하나</strong>씩 평면도를 크게 넣어요. 컷
            제목과 메모는 글상자라서 파워포인트·구글 슬라이드·한쇼에서 바로 고칠 수 있어요.
          </p>
          <p className="hint">
            슬라이드 노트에는 배우마다 무대 앞 번호(예: 왼 2)가 적혀 있어서, 연습 때 화면에 띄워
            놓고 말로 알려 주기 좋아요.
          </p>
          <p className="hint">
            지금 화면 설정을 그대로 씁니다 — {prefs.flipped ? '무대에서 본 모습' : '객석에서 본 모습'}
            , 이름표 {MARK_SIZE_LABELS[prefs.markSize]}, 9구역 선 {prefs.showGrid ? '켬' : '끔'}, 지나온 길{' '}
            {prefs.showTrails ? TRAIL_MODE_LABELS[prefs.trailMode] : '끔'}.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? '만드는 중이에요…' : 'PPT 저장하기'}
          </button>
        </Modal>
      )}
    </>
  )
}
