import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import ChichibooFooter from './components/ChichibooFooter'
import ErrorBoundary from './components/ErrorBoundary'
import UpdateNotice from './components/UpdateNotice'
import HomePage from './pages/HomePage'
import HelpPage from './pages/HelpPage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectPage from './pages/ProjectPage'
import RosterPage from './pages/RosterPage'
import NewCutPage from './pages/NewCutPage'
import { NavigationTracker } from './lib/navigation'

// 캔버스(Konva)와 영상 화면은 무거워서, 그 화면에 들어갈 때만 불러온다.
const CutStagePage = lazy(() => import('./pages/CutStagePage'))
const CutPeoplePage = lazy(() => import('./pages/CutPeoplePage'))
const PlayPage = lazy(() => import('./pages/PlayPage'))
const VideoPage = lazy(() => import('./pages/VideoPage'))

/**
 * 컷이 바뀌면 이름 붙이기 화면을 새로 연다.
 * ('다음 컷'으로 넘어갈 때 앞 컷의 네모·이름·되돌리기 기록이 섞이지 않게)
 */
function CutPeopleRoute() {
  const { cutId } = useParams()
  return <CutPeoplePage key={cutId} />
}

/** 무거운 화면을 불러오는 동안 잠깐 보이는 화면 */
function Loading() {
  return (
    <main className="app-main">
      <div className="empty" role="status">
        <span className="spinner" aria-hidden="true" />
        <p>화면을 여는 중이에요…</p>
      </div>
    </main>
  )
}

/** 무거운 화면을 감싸는 껍데기 (불러오기 + 오류 막기) */
function Heavy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

export default function App() {
  return (
    // GitHub Pages에서는 주소에 # 을 쓰는 방식이 가장 안전하다.
    <HashRouter>
      <NavigationTracker />
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          바로 본문으로 가기
        </a>

        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/project/new" element={<ProjectFormPage />} />
            <Route path="/project/:id" element={<ProjectPage />} />
            <Route path="/project/:id/edit" element={<ProjectFormPage />} />
            <Route path="/project/:id/roster" element={<RosterPage />} />
            <Route path="/project/:id/cut/new" element={<NewCutPage />} />
            <Route
              path="/project/:id/cut/:cutId/stage"
              element={
                <Heavy>
                  <CutStagePage />
                </Heavy>
              }
            />
            <Route
              path="/project/:id/cut/:cutId/people"
              element={
                <Heavy>
                  <CutPeopleRoute />
                </Heavy>
              }
            />
            <Route
              path="/project/:id/video"
              element={
                <Heavy>
                  <VideoPage />
                </Heavy>
              }
            />
            <Route
              path="/project/:id/play"
              element={
                <Heavy>
                  <PlayPage />
                </Heavy>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>

        <ChichibooFooter />
      </div>

      <UpdateNotice />

      <Toaster
        position="top-center"
        richColors
        // 머리말(뒤로·도움말 버튼)을 가리지 않도록 조금 내려서 띄운다.
        offset={76}
        duration={2600}
        // 알림이 쌓여 안내 띠를 가리지 않도록 한 번에 두 개까지만
        visibleToasts={2}
        toastOptions={{
          style: { fontFamily: 'var(--font-body)', fontSize: '17px', wordBreak: 'keep-all' },
        }}
      />
    </HashRouter>
  )
}
