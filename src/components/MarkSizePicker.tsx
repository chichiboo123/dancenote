import { MARK_SIZE_LABELS, useViewPrefs, type MarkSize } from '../store/viewPrefs'

/** 평면도 이름표 크기 고르기 (작게 / 보통 / 크게). 모든 화면에 함께 적용되고 기억된다. */
export default function MarkSizePicker() {
  const markSize = useViewPrefs((s) => s.markSize)
  const set = useViewPrefs((s) => s.set)
  return (
    <div className="mark-size" role="group" aria-label="이름표 크기">
      <span className="mark-size-label">이름표 크기</span>
      <div className="toolbar segmented">
        {(Object.keys(MARK_SIZE_LABELS) as MarkSize[]).map((size) => (
          <button
            key={size}
            type="button"
            className={`btn btn-ghost${markSize === size ? ' is-on' : ''}`}
            onClick={() => set({ markSize: size })}
            aria-pressed={markSize === size}
          >
            {MARK_SIZE_LABELS[size]}
          </button>
        ))}
      </div>
    </div>
  )
}
