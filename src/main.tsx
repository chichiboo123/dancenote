import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTheme } from './store/theme'
import { askPersistentStorage } from './lib/storagePersist'

initTheme()
// 저장한 공연이 저절로 지워지지 않도록 브라우저에 부탁해 둔다.
void askPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
