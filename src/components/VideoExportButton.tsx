import { useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { db } from '../db/db'
import { downloadFile, safeFileName } from '../lib/backup'
import { canMakeVideo, exportPlaybackVideo } from '../lib/videoExport'
import {
  MARK_SIZE_LABELS,
  MARK_SIZE_SCALE,
  SPEED_LABELS,
  SPEED_SECONDS,
  TRAIL_MODE_LABELS,
  useViewPrefs,
} from '../store/viewPrefs'

/** 동선 재생을 영상(MP4)으로 내려받기 */
export default function VideoExportButton({
  projectId,
  focusId = null,
  focusName,
  className = 'btn btn-ghost',
  label = '동선 영상',
  disabled = false,
}: {
  projectId: string
  /** 한 배우만 따라가는 중이면 그 배우 */
  focusId?: string | null
  focusName?: string
  className?: string
  label?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ratio, setRatio] = useState(0)
  const prefs = useViewPrefs()
  const supported = canMakeVideo()

  async function handleExport() {
    setBusy(true)
    setRatio(0)
    try {
      const project = await db.projects.get(projectId)
      if (!project) throw new Error('공연을 찾을 수 없어요.')
      const cuts = await db.cuts.where('projectId').equals(projectId).sortBy('order')
      const students = await db.students.where('projectId').equals(projectId).sortBy('order')
      if (cuts.length < 2) {
        toast.error('컷이 두 개 이상이어야 영상을 만들 수 있어요.')
        return
      }

      const video = await exportPlaybackVideo(project, cuts, students, {
        secondsPerCut: SPEED_SECONDS[prefs.speed],
        showTrails: prefs.showTrails,
        trailMode: prefs.trailMode,
        showGrid: prefs.showGrid,
        flipped: prefs.flipped,
        markScale: MARK_SIZE_SCALE[prefs.markSize],
        focusId,
        onProgress: setRatio,
      })
      const fileName = safeFileName('dongseon-video', video.extension)
      downloadFile(video.blob, fileName, video.mimeType)
      toast.success(`동선 영상을 저장했어요! (${fileName})`)
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('동선 영상을 만들지 못했어요.')
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
        title="동선 재생을 영상 파일로 저장"
      >
        <Clapperboard size={20} aria-hidden="true" />
        {label}
      </button>

      {open && (
        <Modal title="동선 영상으로 저장" onClose={() => (busy ? undefined : setOpen(false))}>
          {supported ? (
            <>
              <p className="hint">
                동선 재생을 <strong>MP4 영상</strong>으로 만들어요. 카카오톡·밴드로 보내거나 PPT에
                넣어도 잘 열려요. 실제 재생보다 훨씬 빨리 만들어져요.
              </p>
              <p className="hint">
                지금 설정을 그대로 씁니다 — 속도 <strong>{SPEED_LABELS[prefs.speed]}</strong>, 이름표{' '}
                {MARK_SIZE_LABELS[prefs.markSize]},{' '}
                {prefs.flipped ? '무대에서 본 모습' : '객석에서 본 모습'}, 9구역 선{' '}
                {prefs.showGrid ? '켬' : '끔'}, 지나온 길{' '}
                {prefs.showTrails ? TRAIL_MODE_LABELS[prefs.trailMode] : '끔'}
                {focusName ? `, ${focusName}만 따라가기` : ''}.
              </p>

              {busy && (
                <div className="video-progress" role="status" aria-live="polite">
                  <progress value={ratio} max={1} aria-label="영상 만드는 중" />
                  <span>{Math.round(ratio * 100)}%</span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleExport}
                disabled={busy}
              >
                {busy ? '영상을 만드는 중이에요…' : '영상 저장하기'}
              </button>
            </>
          ) : (
            <p className="hint">
              이 브라우저는 영상 만들기를 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 다시 해
              보세요.
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
