import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 글꼴과 아이콘은 앱 안에 담아 둔다. (학교 방화벽이 CDN을 막거나 오프라인이어도 똑같이 보이게)
import 'pretendard-gov/dist/web/variable/pretendardvariable-gov-dynamic-subset.css'
import 'material-icons/iconfont/outlined.css'
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
