import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { db } from '../db/db'
import { downloadFile, safeFileName } from '../lib/backup'
import { exportCutsToPdf } from '../lib/pdfExport'
import { useViewPrefs } from '../store/viewPrefs'

/** 전체 컷을 동선표 PDF로 내보내기 */
export default function PdfExportButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [perPage, setPerPage] = useState<4 | 6>(4)
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

      const blob = await exportCutsToPdf(project, cuts, students, {
        perPage,
        showTrails: prefs.showTrails,
        showGrid: prefs.showGrid,
        flipped: prefs.flipped,
      })
      const fileName = safeFileName('dongseon-pyo', 'pdf')
      downloadFile(blob, fileName, 'application/pdf')
      toast.success(`동선표를 저장했어요! (${fileName})`)
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('동선표를 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <FileDown size={22} aria-hidden="true" />
        동선표 PDF
      </button>

      {open && (
        <Modal title="동선표 PDF로 저장" onClose={() => setOpen(false)}>
          <p className="hint">
            컷을 여러 개씩 한 장에 모아 인쇄하기 좋은 표로 만들어요. 컷 제목과 메모도 함께
            들어가요.
          </p>

          <div className="field">
            <span className="field-label">한 장에 몇 컷씩 넣을까요?</span>
            <div className="preset-row">
              {([4, 6] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-ghost${perPage === n ? ' is-on' : ''}`}
                  onClick={() => setPerPage(n)}
                  aria-pressed={perPage === n}
                >
                  {n}컷
                  <span className="preset-size">{n === 4 ? '크게 보여요' : '많이 담겨요'}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="hint">
            지금 화면 설정을 그대로 씁니다 — {prefs.flipped ? '무대에서 본 모습' : '객석에서 본 모습'}
            , 9구역 선 {prefs.showGrid ? '켬' : '끔'}, 지나온 길 {prefs.showTrails ? '켬' : '끔'}.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? '만드는 중이에요…' : 'PDF 저장하기'}
          </button>
        </Modal>
      )}
    </>
  )
}
