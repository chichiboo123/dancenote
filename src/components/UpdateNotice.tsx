import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * 새 버전이 준비되면 알려 준다.
 * 홈 화면에 설치해 쓰는 경우, 새로고침을 하지 않으면 옛 화면이 계속 보일 수 있어서 필요하다.
 */
export default function UpdateNotice() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return

      const watch = (worker: ServiceWorker | null) => {
        if (!worker) return
        worker.addEventListener('statechange', () => {
          // 이미 쓰고 있는 앱이 있는 상태에서 새 버전이 준비되면 알려 준다.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setReady(true)
          }
        })
      }

      watch(reg.installing)
      reg.addEventListener('updatefound', () => watch(reg.installing))
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return null

  return (
    <div className="update-notice" role="status">
      <span>새 버전이 준비됐어요!</span>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        <RefreshCw size={20} aria-hidden="true" />
        지금 바꾸기
      </button>
    </div>
  )
}
