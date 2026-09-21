import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type Konva from 'konva'
import {
  FlipVertical2,
  Grid3x3,
  ImageDown,
  Pause,
  Play,
  Route,
  SkipBack,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import StagePlan, { type Mark, type Trail } from '../components/StagePlan'
import CutTimeline from '../components/CutTimeline'
import { db } from '../db/db'
import { textColorOn } from '../lib/colors'
import { downloadDataUrl, safeFileName } from '../lib/backup'
import { SPEED_LABELS, SPEED_SECONDS, useViewPrefs, type PlaySpeed } from '../store/viewPrefs'
import type { Cut, Student } from '../db/types'

/** 시작과 끝을 부드럽게 (가속 → 감속) */
function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export default function PlayPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const project = useLiveQuery(async () => (await db.projects.get(id)) ?? null, [id])
  const cuts = useLiveQuery(
    () => db.cuts.where('projectId').equals(id).sortBy('order'),
    [id],
    [] as Cut[],
  )
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(id).sortBy('order'),
    [id],
    [] as Student[],
  )

  const prefs = useViewPrefs()
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const planStageRef = useRef<Konva.Stage | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  // 재생 중에는 ref를 기준으로 계산한다. (상태 갱신 함수 안에서 다른 일을 하지 않기 위해)
  const progressRef = useRef(0)

  /** 재생 위치를 한 번에 바꾼다. */
  const seek = useCallback((value: number) => {
    progressRef.current = value
    setProgress(value)
  }, [])

  const studentById = useMemo(() => {
    const map: Record<string, Student> = {}
    for (const s of students) map[s.id] = s
    return map
  }, [students])

  const lastIndex = Math.max(0, cuts.length - 1)

  // 재생 — 화면이 그려질 때마다 조금씩 앞으로 나아간다.
  useEffect(() => {
    if (!playing || cuts.length < 2) return
    lastTimeRef.current = performance.now()

    const step = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      const next = progressRef.current + dt / SPEED_SECONDS[prefs.speed]
      if (next >= lastIndex) {
        // 마지막 컷에 닿으면 멈춘다.
        progressRef.current = lastIndex
        setProgress(lastIndex)
        setPlaying(false)
        return
      }
      progressRef.current = next
      setProgress(next)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, prefs.speed, lastIndex, cuts.length])

  const handlePlay = useCallback(() => {
    if (cuts.length < 2) {
      toast('컷이 두 개 이상이어야 동선을 재생할 수 있어요.')
      return
    }
    // 끝까지 갔으면 처음으로 돌아가서 다시 재생한다.
    if (progressRef.current >= lastIndex - 0.001) seek(0)
    setPlaying(true)
  }, [cuts.length, lastIndex, seek])

  /** 지금 이 순간 학생들이 서 있는 자리 */
  const marks: Mark[] = useMemo(() => {
    if (cuts.length === 0) return []
    const i = Math.min(lastIndex, Math.floor(progress))
    const f = ease(Math.min(1, Math.max(0, progress - i)))
    const a = cuts[i]
    const b = cuts[Math.min(lastIndex, i + 1)]

    const ids = new Set<string>([
      ...a.placements.map((p) => p.studentId),
      ...b.placements.map((p) => p.studentId),
    ])

    const list: Mark[] = []
    for (const studentId of ids) {
      const student = studentById[studentId]
      if (!student) continue
      const pa = a.placements.find((p) => p.studentId === studentId)
      const pb = b.placements.find((p) => p.studentId === studentId)

      let x: number
      let y: number
      let opacity = 1
      if (pa && pb) {
        x = pa.x + (pb.x - pa.x) * f
        y = pa.y + (pb.y - pa.y) * f
      } else if (pa) {
        x = pa.x
        y = pa.y
        opacity = 1 - f // 다음 컷에 없으면 스르르 사라진다
      } else {
        x = pb!.x
        y = pb!.y
        opacity = f // 다음 컷에서 새로 나타난다
      }

      list.push({
        id: studentId,
        x,
        y,
        color: student.color,
        label: student.shortName,
        opacity,
        faded: Boolean(focusId) && focusId !== studentId,
      })
    }
    return list
  }, [cuts, progress, lastIndex, studentById, focusId])

  /** 지나온 길 */
  const trails: Trail[] = useMemo(() => {
    if (!prefs.showTrails || cuts.length < 2) return []
    const upto = Math.min(lastIndex, Math.floor(progress))
    return students.flatMap((student) => {
      const points: { x: number; y: number }[] = []
      for (let i = 0; i <= upto; i++) {
        const p = cuts[i].placements.find((pl) => pl.studentId === student.id)
        if (p) points.push({ x: p.x, y: p.y })
      }
      const now = marks.find((m) => m.id === student.id)
      if (now) points.push({ x: now.x, y: now.y })
      if (points.length < 2) return []
      return [
        {
          id: student.id,
          color: student.color,
          points,
          faded: Boolean(focusId) && focusId !== student.id,
        },
      ]
    })
  }, [prefs.showTrails, cuts, progress, lastIndex, students, marks, focusId])

  function savePlanImage() {
    const stage = planStageRef.current
    if (!stage) return
    const cutNo = Math.round(progress) + 1
    const name = safeFileName('plan', 'png', `cut${cutNo}`)
    downloadDataUrl(stage.toDataURL({ pixelRatio: 2 }), name)
    toast.success(`평면도를 그림으로 저장했어요! (${name})`)
  }

  if (project === undefined) return null
  if (!project) {
    return (
      <>
        <AppHeader backTo="/" title="공연을 찾을 수 없어요" />
        <main className="app-main">
          <div className="empty">
            <p>이 공연은 지워졌어요.</p>
          </div>
        </main>
      </>
    )
  }

  const currentCut = cuts[Math.round(progress)]

  return (
    <>
      <AppHeader
        backTo={`/project/${id}`}
        title="동선 재생"
        help={{
          title: '동선 재생은 이렇게 써요',
          body: (
            <>
              <p>
                ▶ 버튼을 누르면 컷 1 → 2 → 3 순서로 친구들이 움직여요. 속도도 고를 수 있어요.
              </p>
              <p>
                아래 친구 이름을 누르면 <strong>그 친구만 진하게</strong> 보여요. 한 번 더 누르면
                모두 다시 보여요.
              </p>
              <p>
                <strong>반대쪽에서 보기</strong>를 누르면 무대 위에서 객석을 바라본 모습으로
                바뀌어요. 무대에 서서 연습시킬 때 편해요.
              </p>
              <p>컷 그림을 끌어서 순서를 바꾸고, 연필을 눌러 제목과 메모를 적을 수 있어요.</p>
            </>
          ),
        }}
      />

      <main className="app-main work-main">
        {cuts.length === 0 ? (
          <div className="empty">
            <Route size={48} aria-hidden="true" />
            <p>아직 기록한 컷이 없어요.</p>
            <button
              type="button"
              className="btn btn-primary btn-big"
              onClick={() => navigate(`/project/${id}/cut/new`)}
            >
              컷 기록하러 가기
            </button>
          </div>
        ) : (
          <>
            <div className="guide-bar" role="status">
              <Route size={24} aria-hidden="true" />
              <span>
                {currentCut ? `${Math.round(progress) + 1}번 컷 · ${currentCut.title}` : ''}
                {currentCut?.memo ? ` — ${currentCut.memo}` : ''}
              </span>
            </div>

            <StagePlan
              stageWidthM={project.stageWidthM}
              stageDepthM={project.stageDepthM}
              marks={marks}
              trails={trails}
              showGrid={prefs.showGrid}
              flipped={prefs.flipped}
              stageRef={planStageRef}
              onSelectMark={(markId) => setFocusId((prev) => (prev === markId ? null : markId))}
            />

            {/* 재생 조작 */}
            <div className="play-bar">
              <button
                type="button"
                className="btn btn-quiet btn-icon"
                onClick={() => {
                  setPlaying(false)
                  seek(0)
                }}
                aria-label="처음으로"
              >
                <SkipBack size={24} aria-hidden="true" />
              </button>

              <button
                type="button"
                className="btn btn-primary btn-big play-button"
                onClick={() => (playing ? setPlaying(false) : handlePlay())}
              >
                {playing ? (
                  <>
                    <Pause size={26} aria-hidden="true" />
                    멈춤
                  </>
                ) : (
                  <>
                    <Play size={26} aria-hidden="true" />
                    동선 재생
                  </>
                )}
              </button>

              <input
                className="slider play-slider"
                type="range"
                min={0}
                max={Math.max(0.001, lastIndex)}
                step={0.01}
                value={progress}
                onChange={(e) => {
                  setPlaying(false)
                  seek(Number(e.target.value))
                }}
                aria-label="재생 위치"
              />
            </div>

            <div className="toolbar">
              {(Object.keys(SPEED_LABELS) as PlaySpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-ghost${prefs.speed === s ? ' is-on' : ''}`}
                  onClick={() => prefs.set({ speed: s })}
                  aria-pressed={prefs.speed === s}
                >
                  {SPEED_LABELS[s]}
                </button>
              ))}
            </div>

            <div className="toolbar">
              <button
                type="button"
                className={`btn btn-ghost${prefs.showTrails ? ' is-on' : ''}`}
                onClick={() => prefs.set({ showTrails: !prefs.showTrails })}
                aria-pressed={prefs.showTrails}
              >
                <Route size={22} aria-hidden="true" />
                지나온 길
              </button>
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
                className={`btn btn-ghost${prefs.flipped ? ' is-on' : ''}`}
                onClick={() => prefs.set({ flipped: !prefs.flipped })}
                aria-pressed={prefs.flipped}
              >
                <FlipVertical2 size={22} aria-hidden="true" />
                {prefs.flipped ? '무대에서 본 모습' : '객석에서 본 모습'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={savePlanImage}>
                <ImageDown size={22} aria-hidden="true" />
                그림으로 저장
              </button>
            </div>

            {/* 한 친구만 따라가기 */}
            {students.length > 0 && (
              <section>
                <h2 className="section-title">
                  <Users size={20} aria-hidden="true" /> 한 친구만 따라가기
                </h2>
                <div className="chip-grid">
                  {students.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`picker-chip${focusId === s.id ? ' is-current' : ''}`}
                      style={{
                        background: s.color,
                        color: textColorOn(s.color),
                        opacity: focusId && focusId !== s.id ? 0.45 : 1,
                      }}
                      onClick={() => setFocusId((prev) => (prev === s.id ? null : s.id))}
                      aria-pressed={focusId === s.id}
                    >
                      <span className="picker-name">{s.name}</span>
                    </button>
                  ))}
                </div>
                {focusId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setFocusId(null)}
                    style={{ marginTop: 'var(--sp-3)' }}
                  >
                    모두 보기
                  </button>
                )}
              </section>
            )}

            <CutTimeline
              projectId={id}
              cuts={cuts}
              activeId={currentCut?.id}
              onOpen={(cut) => {
                setPlaying(false)
                seek(cuts.findIndex((c) => c.id === cut.id))
              }}
            />
          </>
        )}
      </main>
    </>
  )
}
