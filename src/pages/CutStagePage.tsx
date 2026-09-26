import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  CopyCheck,
  Eraser,
  Grid3x3,
  MapPin,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import PhotoCanvas from '../components/PhotoCanvas'
import StagePlan, { type Mark } from '../components/StagePlan'
import ConfirmDialog from '../components/ConfirmDialog'
import { db } from '../db/db'
import {
  applyStageCornersToAllCuts,
  deleteCut,
  inheritedCorners,
  rememberStageCorners,
  updateCut,
} from '../db/repo'
import { loadImage, releaseImage } from '../lib/image'
import { CORNER_LABELS, createStageMapper, isValidQuad } from '../lib/homography'
import type { Point } from '../db/types'
import { josa } from '../lib/names'
import { useAutoSave } from '../lib/useAutoSave'
import { useViewPrefs } from '../store/viewPrefs'

/** 확인용으로 찍어 보는 점 (저장되지 않는다) */
interface TestMark extends Point {
  id: string
  color: string
}

const TEST_COLORS = ['#FF6B4A', '#3CC7A8', '#0072B2', '#9C27B0', '#EF6C00']

export default function CutStagePage() {
  const { id = '', cutId = '' } = useParams()
  const navigate = useNavigate()

  // 불러오는 중이면 undefined, 자료가 없으면 null로 구분한다.
  const cut = useLiveQuery(async () => (await db.cuts.get(cutId)) ?? null, [cutId])
  const project = useLiveQuery(async () => (await db.projects.get(id)) ?? null, [id])
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [testMarks, setTestMarks] = useState<TestMark[]>([])
  const prefs = useViewPrefs()
  const [pane, setPane] = useState<'photo' | 'plan'>('photo')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loadedCutRef = useRef<string | null>(null)
  // 이 화면에서 점을 건드렸는지 (물려받은 그대로인지 구분용)
  const [touched, setTouched] = useState(false)

  // 사진 읽기
  useEffect(() => {
    if (!cut?.imageBlob) return
    let alive = true
    let loaded: HTMLImageElement | null = null
    loadImage(cut.imageBlob)
      .then((img) => {
        if (!alive) {
          releaseImage(img)
          return
        }
        loaded = img
        setImage(img)
      })
      .catch(() => toast.error('사진을 열 수 없어요.'))
    return () => {
      alive = false
      releaseImage(loaded)
    }
  }, [cut?.imageBlob])

  // 저장돼 있던 귀퉁이를 처음 한 번만 가져온다.
  useEffect(() => {
    if (!cut || loadedCutRef.current === cut.id) return
    loadedCutRef.current = cut.id
    setCorners(cut.stageCorners ? [...cut.stageCorners] : [])
    setTestMarks([])
    setTouched(false)
  }, [cut])

  const done = corners.length === 4
  const valid = done && isValidQuad(corners)
  const mapper = useMemo(() => (valid ? createStageMapper(corners) : null), [valid, corners])

  /**
   * 지난 컷(또는 공연 기본값)에서 그대로 물려받은 무대 바닥인지.
   * 화면을 연 뒤 한 번도 점을 건드리지 않았다면 물려받은 그대로다.
   */
  const inherited = !touched && Boolean(cut?.stageCorners) && done

  const planMarks: Mark[] = useMemo(() => {
    if (!mapper) return []
    return testMarks.map((t, i) => {
      const s = mapper.toStage(t)
      return {
        id: t.id,
        x: Math.min(1, Math.max(0, s.x)),
        y: Math.min(1, Math.max(0, s.y)),
        color: t.color,
        label: String(i + 1),
      }
    })
  }, [testMarks, mapper])

  function handleTapImage(p: Point) {
    if (corners.length < 4) {
      const next = [...corners, p]
      setCorners(next)
      setTouched(true)
      if (next.length === 4) {
        setPane('plan')
        toast.success('무대 영역을 다 정했어요! 평면도를 확인해 볼까요?')
      }
      return
    }
    // 이미 다 정했으면, 눌러 본 자리가 평면도 어디인지 보여 준다.
    setTestMarks((prev) => [
      ...prev.slice(-7),
      { ...p, id: `t-${Date.now()}`, color: TEST_COLORS[prev.length % TEST_COLORS.length] },
    ])
    setPane('plan')
  }

  // 네 점을 다 찍으면 바로 저장해 둔다. (화면을 떠나도 다시 찍지 않아도 되게)
  // 이 공연의 기본 무대 영역으로도 기억해 두어, 다음 컷부터는 다시 정하지 않아도 된다.
  useAutoSave(valid ? corners : null, async (saved) => {
    if (!saved) return
    const quad = saved as [Point, Point, Point, Point]
    await updateCut(cutId, { stageCorners: quad })
    await rememberStageCorners(id, quad, cut?.imageSize)
  })

  /** 이 공연에 저장해 둔 무대 바닥을 이 컷에 가져온다. */
  const savedCorners = useMemo(
    () => (project ? inheritedCorners(project, cut?.imageSize) : undefined),
    [project, cut?.imageSize],
  )

  function useSavedCorners() {
    if (!savedCorners) return
    setCorners([...savedCorners])
    setTestMarks([])
    setTouched(false)
    setPane('plan')
    toast.success('지난번에 정한 무대 바닥을 가져왔어요!')
  }

  /** 이 무대 영역을 이 공연의 다른 컷에도 적용한다. */
  async function applyToAll(onlyEmpty: boolean) {
    if (!valid) return
    const quad = corners as [Point, Point, Point, Point]
    const changed = await applyStageCornersToAllCuts(id, quad, cut?.imageSize, { onlyEmpty })
    toast.success(
      changed > 0
        ? `다른 컷 ${changed}개에도 같은 무대 영역을 적용했어요.`
        : '적용할 다른 컷이 없어요.',
    )
  }

  async function handleSave() {
    if (!valid) return
    const quad = corners as [Point, Point, Point, Point]
    await updateCut(cutId, { stageCorners: quad })
    await rememberStageCorners(id, quad, cut?.imageSize)
    // 사진을 여러 장 한꺼번에 올렸다면, 아직 무대 영역이 없는 컷에도 같이 넣어 둔다.
    // (같은 자리에서 찍은 사진이라 다시 찍지 않아도 된다. 사진 크기가 다른 컷은 건너뛴다)
    const filled = await applyStageCornersToAllCuts(id, quad, cut?.imageSize, { onlyEmpty: true })
    toast.success(
      filled > 0
        ? `무대 영역을 정했어요! 함께 올린 컷 ${filled}개에도 넣어 두었어요.`
        : '무대 영역을 정했어요! 이제 친구들 이름을 붙여 볼까요?',
    )
    navigate(`/project/${id}/cut/${cutId}/people`)
  }

  if (cut === undefined || project === undefined) return null
  if (!cut || !project) {
    return (
      <>
        <AppHeader backTo={`/project/${id}`} title="컷을 찾을 수 없어요" />
        <main className="app-main" id="main-content">
          <div className="empty">
            <p>이 컷은 지워졌어요.</p>
          </div>
        </main>
      </>
    )
  }

  // 사진이 없는 컷(사진 없이 짜기, 사진을 지운 컷)은 네 귀퉁이를 정할 수 없으므로 평면도로 바로 보낸다.
  if (!cut.imageBlob) return <Navigate to={`/project/${id}/cut/${cutId}/people`} replace />

  const guide = !done
    ? `${corners.length + 1}번 — ${CORNER_LABELS[corners.length]}${josa(
        CORNER_LABELS[corners.length],
        '을',
        '를',
      )} 눌러요`
    : valid
      ? '사진 아무 곳이나 눌러 보세요. 평면도에 같은 자리가 표시돼요.'
      : '네 점이 꼬였어요. 점을 끌어서 무대 모양이 되게 맞춰 주세요.'

  return (
    <>
      <AppHeader
        backTo={`/project/${id}`}
        title={cut.title}
        help={{
          title: '무대 영역은 왜 정해요?',
          body: (
            <>
              <p>
                사진은 비스듬히 찍히기 때문에, 무대의 네 귀퉁이를 알려 주면 앱이 그림을 위에서 본
                모습으로 바로 펴 줘요.
              </p>
              <p>
                누르는 순서는 <strong>① 무대 뒤 왼쪽 → ② 무대 뒤 오른쪽 → ③ 무대 앞 오른쪽 → ④
                무대 앞 왼쪽</strong> 이에요. 객석에 앉아서 보는 방향이 기준이에요.
              </p>
              <p>점을 누르고 있으면 옆에 돋보기가 떠서 정확하게 찍을 수 있어요.</p>
            </>
          ),
        }}
      />

      <main className="app-main work-main has-save-bar" id="main-content">
        <div className="guide-bar" role="status">
          <MapPin size={22} aria-hidden="true" />
          <span>{guide}</span>
        </div>

        {/* 네 귀퉁이를 어떤 순서로 누르는지 한눈에 */}
        {!valid && (
          <ol className="corner-steps" aria-label="무대 귀퉁이 누르는 순서">
            {CORNER_LABELS.map((label, i) => (
              <li
                key={label}
                className={i < corners.length ? 'done' : i === corners.length ? 'current' : ''}
                aria-current={i === corners.length ? 'step' : undefined}
              >
                <span className="corner-no">{i < corners.length ? <Check size={14} /> : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}

        {!done && savedCorners && (
          <div className="notice notice-action" role="note">
            <CopyCheck size={22} aria-hidden="true" />
            <span>
              지난번에 정한 <strong>무대 바닥</strong>이 있어요. 같은 자리에서 찍었다면 그대로
              가져다 쓰면 돼요.
            </span>
            <button type="button" className="btn btn-primary btn-small" onClick={useSavedCorners}>
              무대 바닥 가져오기
            </button>
          </div>
        )}

        {inherited && done && (
          <div className="notice" role="note">
            <Check size={22} aria-hidden="true" />
            <span>
              지난 컷에서 정한 <strong>무대 바닥을 그대로 쓰고 있어요.</strong> 카메라를 움직이지
              않았다면 이대로 두고 넘어가면 돼요. 다르면 <strong>처음부터 다시</strong>를 눌러요.
            </span>
          </div>
        )}

        <div className="pane-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pane === 'photo'}
            className={pane === 'photo' ? 'is-on' : ''}
            onClick={() => setPane('photo')}
          >
            사진
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pane === 'plan'}
            className={pane === 'plan' ? 'is-on' : ''}
            onClick={() => setPane('plan')}
          >
            무대 평면도
          </button>
        </div>

        <div className="work-split">
          <section className="pane" data-active={pane === 'photo'} aria-label="사진">
            {image ? (
              <PhotoCanvas
                image={image}
                corners={corners}
                onTapImage={handleTapImage}
                onMoveCorner={(i, p) => {
                  setTouched(true)
                  setCorners((prev) => prev.map((c, idx) => (idx === i ? p : c)))
                }}
              />
            ) : (
              <div className="empty">
                <p>
                  이 컷에는 사진이 없어요. (사진을 저장하지 않는 공연이거나, 사진이 지워졌어요)
                </p>
              </div>
            )}

            <div className="toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTouched(true)
                  setCorners((prev) => prev.slice(0, -1))
                }}
                disabled={corners.length === 0}
              >
                <Undo2 size={22} aria-hidden="true" />
                마지막 점 지우기
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTouched(true)
                  setCorners([])
                  setTestMarks([])
                  setPane('photo')
                }}
                disabled={corners.length === 0}
              >
                <RotateCcw size={22} aria-hidden="true" />
                처음부터 다시
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={22} aria-hidden="true" />이 컷 지우기
              </button>
            </div>
          </section>

          <section className="pane" data-active={pane === 'plan'} aria-label="무대 평면도">
            <StagePlan
              stageWidthM={project.stageWidthM}
              stageDepthM={project.stageDepthM}
              marks={planMarks}
              showGrid={prefs.showGrid}
              flipped={prefs.flipped}
            />
            <div className="toolbar">
              <button
                type="button"
                className={`btn btn-ghost${prefs.showGrid ? ' is-on' : ''}`}
                onClick={() => prefs.set({ showGrid: !prefs.showGrid })}
                aria-pressed={prefs.showGrid}
              >
                <Grid3x3 size={22} aria-hidden="true" />9구역 선
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTestMarks([])}
                disabled={testMarks.length === 0}
              >
                <Eraser size={22} aria-hidden="true" />
                점 지우기
              </button>
            </div>
            {done && testMarks.length === 0 && (
              <p className="hint">
                사진에서 친구가 서 있는 발끝을 눌러 보세요. 평면도에서도 같은 자리에 점이 생기면 잘
                맞춘 거예요.
              </p>
            )}
          </section>
        </div>

        {valid && (
          <div className="notice" role="note">
            <Check size={22} aria-hidden="true" />
            <span>
              이 무대 영역은 <strong>이 공연의 기본값</strong>으로 저장돼요. 같은 자리에서 찍은
              다음 사진·영상은 다시 정하지 않아도 돼요.
            </span>
          </div>
        )}

        {valid && (
          <div className="toolbar">
            <button type="button" className="btn btn-ghost" onClick={() => applyToAll(true)}>
              <CopyCheck size={22} aria-hidden="true" />
              빈 컷에 적용
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => applyToAll(false)}>
              <CopyCheck size={22} aria-hidden="true" />
              모든 컷에 적용
            </button>
          </div>
        )}

        <div className="save-bar">
          <div className="save-bar-inner">
            <div className="save-bar-status">
              <span className="save-bar-count">
                {Math.min(4, corners.length)}
                <small>/4</small>
              </span>
              <span className="save-bar-label">
                {valid ? '무대 영역 완성!' : done ? '모양을 고쳐 주세요' : '귀퉁이를 찍었어요'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!valid}
            >
              <Check size={22} aria-hidden="true" />
              이름 붙이러 가기
            </button>
          </div>
        </div>
      </main>

      {confirmDelete && (
        <ConfirmDialog
          title="이 컷을 지울까요?"
          message="사진과 지금까지 정한 무대 영역이 함께 사라져요."
          onConfirm={async () => {
            await deleteCut(cutId)
            toast.success('컷을 지웠어요.')
            navigate(`/project/${id}`)
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
