import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ImageOff, MapPin } from 'lucide-react'
import type { Cut } from '../db/types'

/** 컷 썸네일을 가로로 늘어놓은 줄 (4단계에서 순서 바꾸기·재생이 붙는다) */
export default function CutStrip({ projectId, cuts }: { projectId: string; cuts: Cut[] }) {
  return (
    <section className="cut-strip-wrap">
      <h2 className="section-title">기록한 컷</h2>
      <ol className="cut-strip">
        {cuts.map((cut) => (
          <li key={cut.id}>
            <Link className="cut-thumb" to={`/project/${projectId}/cut/${cut.id}/stage`}>
              <CutImage cut={cut} />
              <span className="cut-thumb-title">{cut.title}</span>
              <span className="cut-thumb-meta">
                {cut.stageCorners ? (
                  <>
                    <MapPin size={14} aria-hidden="true" /> 무대 영역 있음
                  </>
                ) : (
                  '무대 영역을 정해요'
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function CutImage({ cut }: { cut: Cut }) {
  const url = useMemo(
    () => (cut.imageBlob ? URL.createObjectURL(cut.imageBlob) : null),
    [cut.imageBlob],
  )

  // 화면에서 사라질 때 메모리를 돌려준다.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (!url) {
    return (
      <span className="cut-thumb-img cut-thumb-empty">
        <ImageOff size={26} aria-hidden="true" />
      </span>
    )
  }
  return <img className="cut-thumb-img" src={url} alt="" />
}
