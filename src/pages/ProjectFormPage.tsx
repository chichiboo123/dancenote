import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PencilRuler, Save } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import { db } from '../db/db'
import { useGoBack } from '../lib/navigation'
import { createProject, updateProject } from '../db/repo'

/** 무대 크기를 손으로 안 재도 되도록 미리 담아 둔 값 */
const STAGE_PRESETS = [
  { label: '교실 앞', w: 6, d: 4 },
  { label: '강당', w: 10, d: 6 },
  { label: '큰 무대', w: 14, d: 9 },
]

/** 무대 크기로 적을 수 있는 범위(m) */
const MIN_M = 1
const MAX_M = 60

/** 적은 글자를 무대 길이(m)로 바꾼다. 비었거나 범위를 벗어나면 null. */
function parseMeters(text: string): number | null {
  if (text.trim() === '') return null
  const v = Number(text)
  if (!Number.isFinite(v) || v < MIN_M || v > MAX_M) return null
  // 소수점 오차(8.500000001 같은 값)가 남지 않게 0.01m 단위로 정리한다.
  return Math.round(v * 100) / 100
}

/** 지금 가로·세로가 어느 미리 담아 둔 크기와 같은지 */
function matchPreset(w: number | null, d: number | null) {
  return STAGE_PRESETS.find((p) => p.w === w && p.d === d)
}

export default function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  // 입력 중에는 비우거나 '8.' 처럼 적을 수 있어야 하므로 글자로 들고 있는다.
  const [widthText, setWidthText] = useState('10')
  const [depthText, setDepthText] = useState('6')
  // '사용자 지정'을 직접 눌렀거나 숫자를 손으로 고쳤는지
  const [customPicked, setCustomPicked] = useState(false)
  const [sizeError, setSizeError] = useState<'w' | 'd' | null>(null)
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
      setWidthText(String(p.stageWidthM))
      setDepthText(String(p.stageDepthM))
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
    const width = parseMeters(widthText)
    const depth = parseMeters(depthText)
    if (width === null) {
      setCustomPicked(true)
      setSizeError('w')
      toast.error('무대 가로 길이를 확인해 주세요.')
      return
    }
    if (depth === null) {
      setCustomPicked(true)
      setSizeError('d')
      toast.error('무대 세로 길이를 확인해 주세요.')
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
      goBack(`/project/${id}`)
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

  const preset = customPicked ? undefined : matchPreset(parseMeters(widthText), parseMeters(depthText))
  const isCustom = !preset

  function pickPreset(p: (typeof STAGE_PRESETS)[number]) {
    setWidthText(String(p.w))
    setDepthText(String(p.d))
    setCustomPicked(false)
    setSizeError(null)
  }

  return (
    <>
      <AppHeader
        backTo={isEdit ? `/project/${id}` : '/'}
        title={isEdit ? '공연 정보 고치기' : '새 공연 만들기'}
        help={{
          title: '무대 크기는 왜 적어요?',
          body: (
            <p>
              무대의 가로·세로 길이를 알면 평면도의 모양이 실제 무대와 똑같아지고, 친구 사이
              거리도 알 수 있어요. 대강만 알면 비슷한 크기 버튼을 고르고, 실제 길이를 알면{' '}
              <strong>사용자 지정</strong>을 눌러 직접 적어요. 나중에 언제든 고칠 수 있어요.
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

        <form className="card form-card" onSubmit={handleSubmit} noValidate>
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
            <p className="hint">
              비슷한 크기를 고르거나, 실제 길이를 알면 사용자 지정으로 직접 적어요.
            </p>
            <div className="preset-row" role="radiogroup" aria-label="무대 크기">
              {STAGE_PRESETS.map((p) => {
                const on = preset === p
                return (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`btn btn-ghost${on ? ' is-on' : ''}`}
                    onClick={() => pickPreset(p)}
                  >
                    {p.label}
                    <span className="preset-size">
                      {p.w}×{p.d}m
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                role="radio"
                aria-checked={isCustom}
                className={`btn btn-ghost${isCustom ? ' is-on' : ''}`}
                onClick={() => setCustomPicked(true)}
              >
                <span className="preset-custom-label">
                  <PencilRuler size={16} aria-hidden="true" />
                  사용자 지정
                </span>
                <span className="preset-size">직접 입력</span>
              </button>
            </div>
            {isCustom && (
              <div className="size-row pop-in">
                <div className="field">
                  <label htmlFor="w">무대 가로 (m)</label>
                  <input
                    id="w"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={MIN_M}
                    max={MAX_M}
                    step={0.1}
                    value={widthText}
                    aria-invalid={sizeError === 'w'}
                    onChange={(e) => {
                      setWidthText(e.target.value)
                      setCustomPicked(true)
                      if (sizeError === 'w') setSizeError(null)
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="d">무대 세로 (m)</label>
                  <input
                    id="d"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={MIN_M}
                    max={MAX_M}
                    step={0.1}
                    value={depthText}
                    aria-invalid={sizeError === 'd'}
                    onChange={(e) => {
                      setDepthText(e.target.value)
                      setCustomPicked(true)
                      if (sizeError === 'd') setSizeError(null)
                    }}
                  />
                </div>
                <p className={`hint size-row-hint${sizeError ? ' is-error' : ''}`}>
                  {sizeError === 'w'
                    ? `무대 가로 길이를 확인해 주세요. (${MIN_M}~${MAX_M}m)`
                    : sizeError === 'd'
                      ? `무대 세로 길이를 확인해 주세요. (${MIN_M}~${MAX_M}m)`
                      : `가로는 왼쪽 끝에서 오른쪽 끝, 세로는 객석 쪽에서 무대 뒤까지예요. 0.1m 단위로 적을 수 있어요.`}
                </p>
              </div>
            )}
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
