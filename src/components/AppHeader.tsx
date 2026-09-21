import { ChevronLeft, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useTheme } from '../store/theme'
import HelpButton from './HelpButton'

interface Props {
  /** 뒤로 갈 주소. 없으면 뒤로 버튼 대신 로고를 보여준다. */
  backTo?: string
  title?: string
  /** "?" 도움말에 담을 내용 */
  help?: { title: string; body: React.ReactNode }
}

export default function AppHeader({ backTo, title, help }: Props) {
  const navigate = useNavigate()
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {backTo ? (
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={() => navigate(backTo)}
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={26} aria-hidden="true" />
            <span className="back-label">뒤로</span>
          </button>
        ) : (
          <Logo />
        )}

        {title && <h1 className="app-header-title">{title}</h1>}

        <div className="app-header-actions">
          {help && <HelpButton title={help.title}>{help.body}</HelpButton>}
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={toggle}
            aria-label={theme === 'dark' ? '밝은 무대로 바꾸기' : '어두운 무대로 바꾸기'}
            title={theme === 'dark' ? '밝은 무대' : '어두운 무대'}
          >
            {theme === 'dark' ? (
              <Sun size={24} aria-hidden="true" />
            ) : (
              <Moon size={24} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
