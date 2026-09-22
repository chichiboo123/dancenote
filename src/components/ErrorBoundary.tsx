import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 화면 어딘가에서 예상 못 한 문제가 나도 앱 전체가 하얗게 되지 않도록 막아 준다.
 * 저장된 공연 자료는 기기 안에 그대로 있으니, 다시 열기만 하면 이어서 쓸 수 있다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 개발 중에 원인을 찾을 수 있도록 남긴다. (밖으로 보내지 않는다)
    console.error('화면 오류:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-main" id="main-content">
        <div className="card error-card" role="alert">
          <AlertTriangle size={48} aria-hidden="true" />
          <h2>앗, 이 화면에 문제가 생겼어요</h2>
          <p>
            지금까지 저장한 공연과 친구 명단은 <strong>그대로 있어요.</strong> 아래 버튼으로 다시
            열어 보세요.
          </p>

          <div className="error-actions">
            <button
              type="button"
              className="btn btn-primary btn-big"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={24} aria-hidden="true" />
              다시 열기
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-big"
              onClick={() => {
                window.location.hash = '#/'
                window.location.reload()
              }}
            >
              <Home size={24} aria-hidden="true" />
              첫 화면으로
            </button>
          </div>

          <details className="error-detail">
            <summary>어떤 문제인지 보기</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </main>
    )
  }
}
