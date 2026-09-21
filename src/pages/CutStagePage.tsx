import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
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
import { deleteCut, updateCut } from '../db/repo'
import { loadImage, releaseImage } from '../lib/image'
import { CORNER_LABELS, createStageMapper, isValidQuad } from '../lib/homography'
import type { Point } from '../db/types'
import { josa } from '../lib/names'
import { useAutoSave } from '../lib/useAutoSave'

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
  const prevCut = useLiveQuery(async () => {
    const c = await db.cuts.get(cutId)
    if (!c || c.order === 0) return null
    const all = await db.cuts.where('projectId').equals(c.projectId).sortBy('order')
    return all.find((x) => x.order === c.order - 1) ?? null
  }, [cutId])

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [testMarks, setTestMarks] = useState<TestMark[]>([])
  const [showGrid, setShowGrid] = useState(true)
  const [pane, setPane] = useState<'photo' | 'plan'>('photo')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loadedCutRef = useRef<string | null>(null)

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
  }, [cut])

  const done = corners.length === 4
  const valid = done && isValidQuad(corners)
  const mapper = useMemo(() => (valid ? createStageMapper(corners) : null), [valid, corners])

  /** 이전 컷에서 그대로 물려받은 무대 영역인지 */
  const inherited = useMemo(() => {
    if (!prevCut?.stageCorners || !cut?.stageCorners) return false
    return JSON.stringify(prevCut.stageCorners) === JSON.stringify(cut.stageCorners)
  }, [prevCut, cut])

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
  useAutoSave(valid ? corners : null, async (saved) => {
    if (!saved) return
    await updateCut(cutId, { stageCorners: saved as [Point, Point, Point, Point] })
  })

  async function handleSave() {
    if (!valid) return
    await updateCut(cutId, { stageCorners: corners as [Point, Point, Point, Point] })
    toast.success('무대 영역을 정했어요! 이제 친구들 이름을 붙여 볼까요?')
    navigate(`/project/${id}/cut/${cutId}/people`)
  }

  if (cut === undefined || project === undefined) return null
  if (!cut || !project) {
    return (
      <>
        <AppHeader backTo={`/project/${id}`} title="컷을 찾을 수 없어요" />
        <main className="app-main">
          <div className="empty">
            <p>이 컷은 지워졌어요.</p>
          </div>
        </main>
      </>
    )
  }

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

      <main className="app-main work-main">
        <div className="guide-bar" role="status">
          <MapPin size={24} aria-hidden="true" />
          <span>{guide}</span>
        </div>

        {inherited && done && (
          <div className="notice" role="note">
            <Check size={22} aria-hidden="true" />
            <span>
              <strong>이전 컷과 같은 무대 영역</strong>을 쓰고 있어요. 카메라를 움직이지 않았다면
              이대로 저장하면 돼요.
            </span>
          </div>
        )}

        <div className="pane-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pane === 'photo'}
            className={`btn btn-ghost${pane === 'photo' ? ' is-on' : ''}`}
            onClick={() => setPane('photo')}
          >
            사진
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pane === 'plan'}
            className={`btn btn-ghost${pane === 'plan' ? ' is-on' : ''}`}
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
                onMoveCorner={(i, p) =>
                  setCorners((prev) => prev.map((c, idx) => (idx === i ? p : c)))
                }
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
                onClick={() => setCorners((prev) => prev.slice(0, -1))}
                disabled={corners.length === 0}
              >
                <Undo2 size={22} aria-hidden="true" />
                마지막 점 지우기
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
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
              showGrid={showGrid}
            />
            <div className="toolbar">
              <button
                type="button"
                className={`btn btn-ghost${showGrid ? ' is-on' : ''}`}
                onClick={() => setShowGrid((v) => !v)}
                aria-pressed={showGrid}
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
                확인 점 지우기
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

        <button
          type="button"
          className="btn btn-primary btn-big btn-block next-btn"
          onClick={handleSave}
          disabled={!valid}
        >
          <Check size={26} aria-hidden="true" />이 무대 영역으로 하고 이름 붙이기
        </button>
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
