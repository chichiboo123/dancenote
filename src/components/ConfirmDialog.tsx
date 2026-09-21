import Modal from './Modal'

/** 지우기처럼 되돌리기 어려운 일은 항상 한 번 더 물어본다. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '네, 지울래요',
  cancelLabel = '아니요',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
