import { useEffect, useState } from 'react'
import { CloudDownload, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { isOfflineReady, offlineSupported, prepareOffline } from '../lib/offline'

/** 인터넷 없이 쓸 준비 (사람 찾기 파일 미리 받기) */
export default function OfflineReadyButton() {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 5, currentMB: 0 })

  useEffect(() => {
    isOfflineReady().then(setReady)
  }, [open])

  if (!offlineSupported()) return null

  async function handlePrepare() {
    setBusy(true)
    try {
      const bytes = await prepareOffline(setProgress)
      setReady(true)
      toast.success(`준비 끝! (${(bytes / 1024 / 1024).toFixed(0)}MB) 이제 인터넷 없이도 써요.`)
    } catch (err) {
      console.error(err)
      toast.error('파일을 다 받지 못했어요. 인터넷을 확인하고 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        {ready ? (
          <WifiOff size={22} aria-hidden="true" />
        ) : (
          <CloudDownload size={22} aria-hidden="true" />
        )}
        {ready ? '오프라인 준비 끝' : '오프라인 준비'}
      </button>

      {open && (
        <Modal title="인터넷 없이 쓸 준비" onClose={() => setOpen(false)}>
          <p className="hint">
            사람을 찾아 주는 파일(약 30MB)을 미리 받아 두면, 인터넷이 없는 곳에서도 앱이 그대로
            동작해요. 와이파이가 잘 되는 곳에서 한 번만 누르면 돼요.
          </p>

          {ready && !busy && (
            <div className="notice" role="note">
              <WifiOff size={22} aria-hidden="true" />
              <span>준비가 끝났어요! 비행기 모드에서도 사람 찾기가 동작해요.</span>
            </div>
          )}

          {busy && (
            <p className="paste-count">
              {progress.done} / {progress.total}개 받는 중… ({progress.currentMB.toFixed(0)}MB)
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handlePrepare}
            disabled={busy}
          >
            <CloudDownload size={22} aria-hidden="true" />
            {busy ? '받는 중이에요…' : ready ? '다시 받기' : '지금 준비하기'}
          </button>

          <p className="hint">
            홈 화면에 추가하면 앱처럼 쓸 수 있어요. (사파리 <strong>공유 → 홈 화면에 추가</strong>,
            크롬 <strong>메뉴 → 앱 설치</strong>)
          </p>
        </Modal>
      )}
    </>
  )
}
