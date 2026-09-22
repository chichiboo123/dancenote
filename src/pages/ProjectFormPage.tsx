import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import { db } from '../db/db'
import { createProject, updateProject } from '../db/repo'

/** 무대 크기를 손으로 안 재도 되도록 미리 담아 둔 값 */
const STAGE_PRESETS = [
  { label: '교실 앞', w: 6, d: 4 },
  { label: '강당', w: 10, d: 6 },
  { label: '큰 무대', w: 14, d: 9 },
]

export default function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [width, setWidth] = useState(10)
  const [depth, setDepth] = useState(6)
  const [keepPhotos, setKeepPhotos] = useState(true)
  const [loaded, setLoaded] = useState(!isEdit)

  useEffect(() => {
    if (!id) return
    db.projects.get(id).then((p) => {
      if (!p) {
        toast.error('그 공연을 찾을 수 없어요.')
        navigate('/')
        return
      }
      setTitle(p.title)
      setWidth(p.stageWidthM)
      setDepth(p.stageDepthM)
      setKeepPhotos(p.keepPhotos)
      setLoaded(true)
    })
  }, [id, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('공연 이름을 적어 주세요.')
      return
    }
    if (isEdit && id) {
      await updateProject(id, {
        title: title.trim(),
        stageWidthM: width,
        stageDepthM: depth,
        keepPhotos,
      })
      toast.success('공연 정보를 저장했어요.')
      navigate(`/project/${id}`)
    } else {
      const newProjectId = await createProject({
        title,
        stageWidthM: width,
        stageDepthM: depth,
        keepPhotos,
      })
      toast.success('공연을 만들었어요! 이제 친구들 이름을 넣어 볼까요?')
      navigate(`/project/${newProjectId}/roster`)
    }
  }

  if (!loaded) return null

  return (
    <>
      <AppHeader
        backTo={isEdit ? `/project/${id}` : '/'}
        title={isEdit ? '공연 정보 고치기' : '새 공연 만들기'}
        help={{
          title: '무대 크기는 왜 적어요?',
          body: (
            <p>
              무대의 가로·세로 길이를 알면 평면도의 모양이 실제 무대와 똑같아져요. 정확히 몰라도
              괜찮아요. 아래 버튼으로 비슷한 크기를 고르고, 나중에 언제든 고칠 수 있어요.
            </p>
          ),
        }}
      />

      <main className="app-main" id="main-content">
        <ol className="steps">
          <li aria-current="step">
            <span className="step-no">1</span> 공연 만들기
          </li>
          <li>
            <span className="step-no">2</span> 명단 넣기
          </li>
          <li>
            <span className="step-no">3</span> 컷 기록하기
          </li>
        </ol>

        <form className="card form-card" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">공연 이름</label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 감자마켓"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <span className="field-label">무대 크기</span>
            <p className="hint">비슷한 곳을 눌러도 되고, 숫자를 직접 고쳐도 돼요.</p>
            <div className="preset-row">
              {STAGE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`btn btn-ghost${width === p.w && depth === p.d ? ' is-on' : ''}`}
                  onClick={() => {
                    setWidth(p.w)
                    setDepth(p.d)
                  }}
                >
                  {p.label}
                  <span className="preset-size">
                    {p.w}×{p.d}m
                  </span>
                </button>
              ))}
            </div>
            <div className="size-row">
              <div className="field">
                <label htmlFor="w">가로 (m)</label>
                <input
                  id="w"
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  step={0.5}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="d">세로 (m)</label>
                <input
                  id="d"
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  step={0.5}
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={!keepPhotos}
              onChange={(e) => setKeepPhotos(!e.target.checked)}
            />
            <span>
              <strong>사진은 저장하지 않고 위치만 저장하기</strong>
              <span className="hint">
                켜면 컷을 만든 뒤 원본 사진을 지우고, 평면도 위 자리만 남겨요.
              </span>
            </span>
          </label>

          <button type="submit" className="btn btn-primary btn-big btn-block">
            <Save size={26} aria-hidden="true" />
            {isEdit ? '저장하기' : '만들고 명단 넣기'}
          </button>
        </form>
      </main>
    </>
  )
}
