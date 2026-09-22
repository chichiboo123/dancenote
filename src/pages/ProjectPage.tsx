import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Camera, Check, Pencil, PlayCircle, Users } from 'lucide-react'
import CutTimeline from '../components/CutTimeline'
import { ExportProjectButton } from '../components/BackupButtons'
import PdfExportButton from '../components/PdfExportButton'
import AppHeader from '../components/AppHeader'
import StudentChip from '../components/StudentChip'
import { db } from '../db/db'

export default function ProjectPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  // 불러오는 중이면 undefined, 자료가 없으면 null로 구분한다.
  const project = useLiveQuery(async () => (await db.projects.get(id)) ?? null, [id])
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(id).sortBy('order'),
    [id],
    [],
  )
  const cuts = useLiveQuery(() => db.cuts.where('projectId').equals(id).sortBy('order'), [id], [])

  if (project === undefined) return null
  if (project === null) {
    return (
      <>
        <AppHeader backTo="/" title="공연을 찾을 수 없어요" />
        <main className="app-main" id="main-content">
          <div className="empty">
            <p>이 공연은 지워졌거나 다른 기기에 있어요.</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              첫 화면으로 가기
            </button>
          </div>
        </main>
      </>
    )
  }

  // 지금 상태를 보고 다음에 할 일을 하나만 골라 알려 준다.
  const cutsWithNames = cuts.filter((c) => c.placements.length > 0).length
  const nextStep =
    students.length === 0
      ? {
          to: `/project/${id}/roster`,
          label: '친구 이름부터 넣어요',
          icon: <Users size={24} aria-hidden="true" />,
        }
      : cuts.length === 0
        ? {
            to: `/project/${id}/cut/new`,
            label: '연습 장면을 가져와요',
            icon: <Camera size={24} aria-hidden="true" />,
          }
        : cutsWithNames < cuts.length
          ? {
              to: `/project/${id}/cut/${
                cuts.find((c) => c.placements.length === 0)?.id ?? cuts[0].id
              }/${cuts.find((c) => c.placements.length === 0)?.stageCorners ? 'people' : 'stage'}`,
              label: '아직 이름을 안 붙인 컷이 있어요',
              icon: <Users size={24} aria-hidden="true" />,
            }
          : cuts.length < 2
            ? {
                to: `/project/${id}/cut/new`,
                label: '컷을 하나 더 만들면 동선을 볼 수 있어요',
                icon: <Camera size={24} aria-hidden="true" />,
              }
            : {
                to: `/project/${id}/play`,
                label: '동선을 재생해 봐요',
                icon: <Check size={24} aria-hidden="true" />,
              }

  return (
    <>
      <AppHeader
        backTo="/"
        title={project.title}
        help={{
          title: '이 화면에서 뭘 해요?',
          body: (
            <p>
              먼저 <strong>친구 명단</strong>에 이름을 넣어요. 그 다음 <strong>컷 기록하기</strong>
              에서 연습 사진을 찍으면 무대 평면도에 친구들이 나타나요.
            </p>
          ),
        }}
      />

      <main className="app-main" id="main-content">
        <section className="next-step" role="status">
          <span className="next-step-label">다음에 할 일</span>
          <Link className="next-step-action" to={nextStep.to}>
            {nextStep.icon}
            <span>{nextStep.label}</span>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </section>

        <section className="card project-summary">
          <p className="project-meta">
            무대 {project.stageWidthM}m × {project.stageDepthM}m
            {!project.keepPhotos && ' · 사진을 저장하지 않는 공연'}
          </p>
          <div className="toolbar">
            <Link className="btn btn-ghost" to={`/project/${id}/edit`}>
              <Pencil size={22} aria-hidden="true" />
              공연 정보 고치기
            </Link>
            <PdfExportButton projectId={id} />
            <ExportProjectButton projectId={id} />
          </div>
        </section>

        <div className="big-actions">
          <Link className="big-action" to={`/project/${id}/roster`}>
            <span className="big-action-no">1</span>
            <Users size={40} aria-hidden="true" />
            <strong>친구 명단</strong>
            <span>{students.length > 0 ? `${students.length}명 등록됨` : '이름을 넣어요'}</span>
          </Link>

          <Link className="big-action" to={`/project/${id}/cut/new`}>
            <span className="big-action-no">2</span>
            <Camera size={40} aria-hidden="true" />
            <strong>컷 기록하기</strong>
            <span>{cuts.length > 0 ? `컷 ${cuts.length}개` : '사진을 가져와요'}</span>
          </Link>

          <Link className="big-action" to={`/project/${id}/play`}>
            <span className="big-action-no">3</span>
            <PlayCircle size={40} aria-hidden="true" />
            <strong>동선 재생</strong>
            <span>{cuts.length >= 2 ? '컷을 이어서 봐요' : '컷이 2개 이상이면 볼 수 있어요'}</span>
          </Link>
        </div>

        {cuts.length > 0 && (
          <CutTimeline
            projectId={id}
            cuts={cuts}
            onOpen={(cut) =>
              navigate(
                // 사진이 없거나 무대 영역이 이미 있으면 바로 이름 붙이기로 간다.
                cut.stageCorners || !cut.imageBlob
                  ? `/project/${id}/cut/${cut.id}/people`
                  : `/project/${id}/cut/${cut.id}/stage`,
              )
            }
            onCreated={(cutId) => navigate(`/project/${id}/cut/${cutId}/people`)}
          />
        )}

        {students.length > 0 && (
          <section className="roster-preview">
            <h2 className="section-title">우리 반 친구들</h2>
            <div className="chip-grid">
              {students.map((s) => (
                <StudentChip key={s.id} student={s} onClick={() => navigate(`/project/${id}/roster`)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
