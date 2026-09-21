import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Users, ShieldCheck, Clapperboard } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import { ImportProjectButton } from '../components/BackupButtons'
import ConfirmDialog from '../components/ConfirmDialog'
import { db } from '../db/db'
import { deleteProject } from '../db/repo'
import type { Project } from '../db/types'

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function HomePage() {
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState<Project | null>(null)

  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [], [])
  const studentCounts = useLiveQuery(
    async () => {
      const all = await db.students.toArray()
      const map: Record<string, number> = {}
      for (const s of all) map[s.projectId] = (map[s.projectId] ?? 0) + 1
      return map
    },
    [],
    {} as Record<string, number>,
  )

  async function handleDelete() {
    if (!toDelete) return
    await deleteProject(toDelete.id)
    toast.success(`'${toDelete.title}' 공연을 지웠어요.`)
    setToDelete(null)
  }

  return (
    <>
      <AppHeader
        help={{
          title: '동선노트가 뭐예요?',
          body: (
            <>
              <p>
                연습 장면을 사진으로 찍으면, 친구들이 무대 어디에 서 있었는지 위에서 내려다본
                그림으로 옮겨 주는 앱이에요.
              </p>
              <p>
                ① 공연을 만들고 ② 친구들 이름을 넣고 ③ 사진을 찍어 컷을 쌓으면, 동선이 움직이는
                모습을 볼 수 있어요.
              </p>
            </>
          ),
        }}
      />

      <main className="app-main">
        <section className="hero">
          <h2 className="hero-title">우리 공연 동선을 기록해요</h2>
          <p className="hero-sub">
            연습 사진을 무대 평면도 위의 동그란 이름표로 옮겨 주는 노트예요.
          </p>
        </section>

        <div className="notice" role="note">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>
            <strong>사진과 이름은 이 기기 안에만 저장돼요.</strong> 인터넷으로 어디에도 보내지
            않고, 얼굴을 알아보지도 않아요. 사람 모양만 찾고 이름은 여러분이 직접 붙여요.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-big btn-block new-project-btn"
          onClick={() => navigate('/project/new')}
        >
          <Plus size={28} aria-hidden="true" />새 공연 만들기
        </button>

        <div className="toolbar">
          <ImportProjectButton onDone={(projectId) => navigate(`/project/${projectId}`)} />
        </div>

        <h2 className="section-title">내 공연</h2>

        {projects.length === 0 ? (
          <div className="empty">
            <Clapperboard size={48} aria-hidden="true" />
            <p>아직 만든 공연이 없어요.</p>
            <p>위의 &lsquo;새 공연 만들기&rsquo; 버튼을 눌러 시작해요!</p>
          </div>
        ) : (
          <ul className="project-grid">
            {projects.map((p) => (
              <li key={p.id} className="card project-card">
                <Link to={`/project/${p.id}`} className="project-card-link">
                  <h3>{p.title}</h3>
                  <p className="project-meta">
                    무대 {p.stageWidthM}m × {p.stageDepthM}m
                  </p>
                  <p className="project-meta">
                    <Users size={18} aria-hidden="true" /> 친구 {studentCounts[p.id] ?? 0}명
                  </p>
                  <p className="project-date">{formatDate(p.updatedAt)}</p>
                </Link>
                <button
                  type="button"
                  className="btn btn-quiet btn-icon project-delete"
                  onClick={() => setToDelete(p)}
                  aria-label={`${p.title} 공연 지우기`}
                >
                  <Trash2 size={22} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {toDelete && (
        <ConfirmDialog
          title="이 공연을 지울까요?"
          message={`'${toDelete.title}' 공연의 명단과 컷이 모두 사라져요. 되돌릴 수 없어요.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
