import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import ChichibooFooter from './components/ChichibooFooter'
import HomePage from './pages/HomePage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectPage from './pages/ProjectPage'
import RosterPage from './pages/RosterPage'
import NewCutPage from './pages/NewCutPage'
import HelpPage from './pages/HelpPage'

// 캔버스(Konva)는 무거워서, 작업 화면에 들어갈 때만 불러온다.
const CutStagePage = lazy(() => import('./pages/CutStagePage'))
const CutPeoplePage = lazy(() => import('./pages/CutPeoplePage'))
const PlayPage = lazy(() => import('./pages/PlayPage'))
const VideoPage = lazy(() => import('./pages/VideoPage'))

export default function App() {
  return (
    // GitHub Pages에서는 주소에 # 을 쓰는 방식이 가장 안전하다.
    <HashRouter>
      <div className="app-shell">
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
              <Suspense fallback={<p className="app-main">화면을 여는 중이에요…</p>}>
                <CutStagePage />
              </Suspense>
            }
          />
          <Route
            path="/project/:id/video"
            element={
              <Suspense fallback={<p className="app-main">화면을 여는 중이에요…</p>}>
                <VideoPage />
              </Suspense>
            }
          />
          <Route
            path="/project/:id/play"
            element={
              <Suspense fallback={<p className="app-main">화면을 여는 중이에요…</p>}>
                <PlayPage />
              </Suspense>
            }
          />
          <Route
            path="/project/:id/cut/:cutId/people"
            element={
              <Suspense fallback={<p className="app-main">화면을 여는 중이에요…</p>}>
                <CutPeoplePage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChichibooFooter />
      </div>
      <Toaster
        position="top-center"
        richColors
        // 머리말(뒤로·도움말 버튼)을 가리지 않도록 조금 내려서 띄운다.
        offset={76}
        duration={2600}
        toastOptions={{
          style: { fontFamily: 'var(--font-body)', fontSize: '17px', wordBreak: 'keep-all' },
        }}
      />
    </HashRouter>
  )
}
