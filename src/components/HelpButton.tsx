import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import Modal from './Modal'

/** 화면마다 붙는 "?" 도움말 */
export default function HelpButton({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="btn btn-quiet btn-icon"
        onClick={() => setOpen(true)}
        aria-label="도움말 보기"
        title="도움말"
      >
        <HelpCircle size={24} aria-hidden="true" />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="help-body">{children}</div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
            알겠어요
          </button>
        </Modal>
      )}
    </>
  )
}
