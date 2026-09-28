import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { lockScroll } from '../lib/scrollLock'

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
  // 부모가 다시 그려질 때마다 onClose가 새로 만들어져도, 아래 준비(첫 칸에 포커스 두기 등)를
  // 다시 하지 않도록 최신 onClose만 따로 들고 있는다. (다시 하면 글자를 칠 때마다 포커스가 닫기 버튼으로 튄다)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    // 열기 전에 어디에 있었는지 기억해 두었다가, 닫을 때 그 자리로 돌려보낸다.
    openerRef.current = document.activeElement as HTMLElement | null

    const box = boxRef.current
    // 안쪽 칸이 스스로 포커스를 잡았으면(autoFocus) 그대로 둔다.
    if (!box?.contains(document.activeElement)) {
      const first = box?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? box)?.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
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
    // 뒤 화면이 같이 스크롤되지 않게 잠근다. (여러 개가 겹쳐 열려도 마지막이 닫힐 때 풀린다)
    const unlockScroll = lockScroll()

    return () => {
      document.removeEventListener('keydown', onKey)
      unlockScroll()
      openerRef.current?.focus?.()
    }
  }, [])

  // 페이지 맨 바깥(body)에 그린다. 버튼이 sticky·transform 같은 겹침 층 안에 있으면
  // z-index가 그 층 안에서만 통해서, 뒤에 그려지는 컷 목록 등이 창 위로 올라오기 때문이다.
  return createPortal(
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
    </div>,
    document.body,
  )
}
