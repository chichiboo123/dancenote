import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/** 대화상자 안에서 키보드로 옮겨 다닐 수 있는 요소들 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // 열기 전에 어디에 있었는지 기억해 두었다가, 닫을 때 그 자리로 돌려보낸다.
    openerRef.current = document.activeElement as HTMLElement | null

    const box = boxRef.current
    const first = box?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? box)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // 탭 키가 대화상자 밖으로 빠져나가지 않게 가둔다.
      if (e.key !== 'Tab' || !box) return
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    // 뒤 화면이 같이 스크롤되지 않게 잠근다.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus?.()
    }
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
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}
