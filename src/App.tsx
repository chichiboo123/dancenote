import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import ChichibooFooter from './components/ChichibooFooter'
import HomePage from './pages/HomePage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectPage from './pages/ProjectPage'
import RosterPage from './pages/RosterPage'

export default function App() {
  return (
    // GitHub Pages에서는 주소에 # 을 쓰는 방식이 가장 안전하다.
    <HashRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/project/new" element={<ProjectFormPage />} />
          <Route path="/project/:id" element={<ProjectPage />} />
          <Route path="/project/:id/edit" element={<ProjectFormPage />} />
          <Route path="/project/:id/roster" element={<RosterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChichibooFooter />
      </div>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ style: { fontFamily: 'var(--font-body)', fontSize: '17px' } }}
      />
    </HashRouter>
  )
}
