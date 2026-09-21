import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/** 화면 가운데(폰에서는 아래에서 올라오는) 대화상자 */
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 열리면 상자 안으로 초점을 옮기고, ESC로 닫을 수 있게 한다.
    boxRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal-box${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={boxRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="닫기">
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}
