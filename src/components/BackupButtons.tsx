import { useRef, useState } from 'react'
import { Download, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import Modal from './Modal'
import { downloadFile, exportProject, importProject } from '../lib/backup'

/** 공연 하나를 백업 파일로 내보내기 */
export function ExportProjectButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [includePhotos, setIncludePhotos] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const { json, fileName } = await exportProject(projectId, { includePhotos })
      downloadFile(json, fileName)
      toast.success(`백업 파일을 저장했어요! (${fileName})`)
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('백업 파일을 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Download size={22} aria-hidden="true" />
        백업 저장
      </button>

      {open && (
        <Modal title="백업 파일로 저장" onClose={() => setOpen(false)}>
          <p className="hint">
            공연 이름, 친구 명단, 컷과 동선을 파일 하나에 담아요. 다른 기기에서 불러오거나, 기기를
            바꾸기 전에 자료를 지킬 때 쓰세요. 파일 이름은 영문으로 저장돼요(브라우저마다 한글
            이름이 깨지는 경우가 있어서예요). 공연 이름은 파일 안에 그대로 들어 있어요.
          </p>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
            />
            <span>
              <strong>사진도 함께 담기</strong>
              <span className="hint">
                파일이 아주 커져요. 사진에 친구들 얼굴이 담기니 파일을 함부로 공유하지 마세요.
              </span>
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? '만드는 중이에요…' : '파일 저장하기'}
          </button>
        </Modal>
      )}
    </>
  )
}

/** 백업 파일에서 공연 불러오기 */
export function ImportProjectButton({ onDone }: { onDone?: (projectId: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const text = await file.text()
      const { projectId, title } = await importProject(text)
      toast.success(`'${title}' 공연을 불러왔어요!`)
      onDone?.(projectId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '파일을 불러오지 못했어요.')
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
        <FolderOpen size={22} aria-hidden="true" />
        백업 불러오기
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
