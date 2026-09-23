import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  Camera,
  Clapperboard,
  Plus,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import { ImportProjectButton } from '../components/BackupButtons'
import Onboarding from '../components/Onboarding'
import OfflineReadyButton from '../components/OfflineReadyButton'
import { hasSeenOnboarding } from '../lib/onboardingSeen'
import ConfirmDialog from '../components/ConfirmDialog'
import { db } from '../db/db'
import { deleteProject } from '../db/repo'
import type { Project } from '../db/types'

/** 공연 카드 위쪽 그림 (첫 컷 사진) */
function ProjectThumb({ blob }: { blob?: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    // 저장소에서 읽은 사진을 화면에 올리는 자리라 상태 설정이 맞다.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return (
    <div className="project-thumb" aria-hidden="true">
      {blob && url ? <img src={url} alt="" /> : <Clapperboard size={40} strokeWidth={1.6} />}
    </div>
  )
}

/** 첫 화면 그림: 위에서 내려다본 무대와 움직이는 이름표 */
function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 440 300" role="presentation">
        <defs>
          <linearGradient id="ha-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7EBD8" />
            <stop offset="1" stopColor="#EFD9B8" />
          </linearGradient>
          <radialGradient id="ha-light" cx="0.5" cy="0.35" r="0.6">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="10" y="10" width="420" height="280" rx="28" fill="#FFFFFF" />
        <rect x="34" y="42" width="372" height="208" rx="16" fill="url(#ha-floor)" />
        <rect x="34" y="42" width="372" height="208" rx="16" fill="url(#ha-light)" />
        <g stroke="#D7B98C" strokeWidth="2" strokeDasharray="7 7" opacity="0.8">
          <line x1="158" y1="42" x2="158" y2="250" />
          <line x1="282" y1="42" x2="282" y2="250" />
          <line x1="34" y1="111" x2="406" y2="111" />
          <line x1="34" y1="180" x2="406" y2="180" />
        </g>
        <rect x="34" y="42" width="372" height="208" rx="16" fill="none" stroke="#C49A66" strokeWidth="3" />
        <line x1="220" y1="238" x2="220" y2="256" stroke="#D32F2F" strokeWidth="4" strokeLinecap="round" />
        <text x="220" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8A91A0">무대 뒤</text>
        <text x="220" y="280" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8A91A0">객석</text>
        <g fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8">
          <path d="M96 196 C 120 150, 150 120, 190 96" stroke="#FF7A9C" />
          <path d="M340 204 C 320 170, 300 150, 262 136" stroke="#3E9BFF" />
          <path d="M214 214 C 226 190, 232 176, 236 160" stroke="#00A68A" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="4">
          <circle cx="96" cy="196" r="18" fill="#FF7A9C" opacity="0.35" />
          <circle cx="190" cy="96" r="20" fill="#FF7A9C" />
          <circle cx="340" cy="204" r="18" fill="#3E9BFF" opacity="0.35" />
          <circle cx="262" cy="136" r="20" fill="#3E9BFF" />
          <circle cx="214" cy="214" r="18" fill="#00A68A" opacity="0.35" />
          <circle cx="236" cy="160" r="20" fill="#00A68A" />
        </g>
        <g fontSize="13" fontWeight="800" fill="#FFFFFF" textAnchor="middle">
          <text x="190" y="101">서준</text>
          <text x="262" y="141">하늘</text>
          <text x="236" y="165">다은</text>
        </g>
        <g transform="translate(318 56)">
          <rect width="96" height="34" rx="17" fill="#1A1D24" opacity="0.88" />
          <circle cx="20" cy="17" r="7" fill="#FFD84D" />
          <text x="58" y="22" textAnchor="middle" fontSize="13" fontWeight="700" fill="#FFFFFF">컷 2 → 3</text>
        </g>
      </svg>
    </div>
  )
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface ProjectCounts {
  students: number
  cuts: number
  thumb?: Blob
  thumbOrder?: number
}

export default function HomePage() {
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState<Project | null>(null)
  // 처음 온 사람에게는 그림 안내를 먼저 보여 준다.
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding())

  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [], [])
  /** 공연마다 친구 수와 컷 수를 미리 세어 둔다. */
  const counts = useLiveQuery(
    async () => {
      const [allStudents, allCuts] = await Promise.all([
        db.students.toArray(),
        db.cuts.toArray(),
      ])
      const map: Record<string, ProjectCounts> = {}
      const entry = (projectId: string) => (map[projectId] ??= { students: 0, cuts: 0 })
      for (const s of allStudents) entry(s.projectId).students += 1
      for (const c of allCuts) {
        const e = entry(c.projectId)
        e.cuts += 1
        // 가장 앞 컷의 사진을 카드 그림으로 쓴다.
        if (c.imageBlob && (e.thumbOrder === undefined || c.order < e.thumbOrder)) {
          e.thumb = c.imageBlob
          e.thumbOrder = c.order
        }
      }
      return map
    },
    [],
    {} as Record<string, ProjectCounts>,
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

      <main className="app-main" id="main-content">
        <section className="hero">
          <div className="hero-text">
            <span className="hero-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              교실 뮤지컬 동선 기록장
            </span>
            <h2 className="hero-title">
              사진 한 장으로
              <br />
              우리 공연 동선을 기록해요
            </h2>
            <p className="hero-sub">
              연습 사진 속 친구들을 찾아서 무대 평면도 위 동그란 이름표로 옮겨 드려요. 컷을
              이어 붙이면 동선이 움직이는 모습도 볼 수 있어요.
            </p>
            <div className="hero-cta">
              <button
                type="button"
                className="btn btn-primary btn-big"
                onClick={() => navigate('/project/new')}
              >
                <Plus size={24} aria-hidden="true" />새 공연 만들기
              </button>
            </div>
          </div>
          <HeroArt />
        </section>

        <ul className="trust-row" aria-label="안심하고 쓰세요">
          <li>
            <span className="trust-icon tone-green">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            사진·이름은 이 기기 안에만
          </li>
          <li>
            <span className="trust-icon tone-pink">
              <ScanFace size={20} aria-hidden="true" />
            </span>
            얼굴은 알아보지 않아요
          </li>
          <li>
            <span className="trust-icon tone-blue">
              <WifiOff size={20} aria-hidden="true" />
            </span>
            인터넷 없이도 돼요
          </li>
        </ul>

        <div className="toolbar quick-actions">
          <Link className="btn btn-ghost" to="/help">
            <BookOpen size={20} aria-hidden="true" />
            사용법 보기
          </Link>
          <ImportProjectButton onDone={(projectId) => navigate(`/project/${projectId}`)} />
          <OfflineReadyButton />
        </div>

        <div className="section-head">
          <h2 className="section-title">
            내 공연
            {projects.length > 0 && <span className="count-badge">{projects.length}</span>}
          </h2>
        </div>

        {projects.length === 0 ? (
          <div className="card empty">
            <Clapperboard size={44} aria-hidden="true" />
            <p>아직 만든 공연이 없어요.</p>
            <p>위의 &lsquo;새 공연 만들기&rsquo; 버튼을 눌러 시작해요!</p>
          </div>
        ) : (
          <ul className="project-grid">
            {projects.map((p) => (
              <li key={p.id} className="card project-card">
                <Link to={`/project/${p.id}`} className="project-card-link">
                  <ProjectThumb blob={counts[p.id]?.thumb} />
                  <div className="project-body">
                    <h3>{p.title}</h3>
                    <p className="project-meta">
                      <span className="meta-pill">
                        <Users size={14} aria-hidden="true" /> 친구 {counts[p.id]?.students ?? 0}명
                      </span>
                      <span className="meta-pill">
                        <Camera size={14} aria-hidden="true" /> 컷 {counts[p.id]?.cuts ?? 0}개
                      </span>
                      <span className="meta-pill">
                        {p.stageWidthM}×{p.stageDepthM}m
                      </span>
                    </p>
                    <p className="project-date">{formatDate(p.updatedAt)} 수정</p>
                  </div>
                </Link>
                <button
                  type="button"
                  className="btn btn-quiet btn-icon project-delete"
                  onClick={() => setToDelete(p)}
                  aria-label={`${p.title} 공연 지우기`}
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

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
