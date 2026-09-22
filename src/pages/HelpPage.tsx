import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  Film,
  Images,
  MapPin,
  PlayCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import AppHeader from '../components/AppHeader'
import Onboarding from '../components/Onboarding'

/** 쉬운 말로 쓴 사용법. 초등학생이 혼자 읽고 따라 할 수 있게 짧게 적었다. */
const STEPS = [
  {
    icon: <Sparkles size={30} aria-hidden="true" />,
    title: '1. 공연을 만들어요',
    lines: [
      '첫 화면에서 새 공연 만들기를 눌러요.',
      '공연 이름을 적고, 무대 크기를 골라요. (잘 모르면 그냥 두어도 돼요)',
    ],
  },
  {
    icon: <Users size={30} aria-hidden="true" />,
    title: '2. 친구 이름을 넣어요',
    lines: [
      '한 명씩 적어도 되고, 여러 명 붙여넣기로 한 번에 넣어도 돼요.',
      '이름마다 색이 저절로 정해져요. 이름을 누르면 색과 배역을 바꿀 수 있어요.',
    ],
  },
  {
    icon: <Camera size={30} aria-hidden="true" />,
    title: '3. 장면을 가져와요',
    lines: [
      '사진 찍기 — 지금 바로 찍어요. 무대가 다 보이게 찍으면 좋아요.',
      '사진 올리기 — 찍어 둔 사진을 골라요. 여러 장도 괜찮아요.',
      '영상 올리기 — 영상을 보다가 좋은 장면에서 멈추고 기록해요.',
    ],
  },
  {
    icon: <MapPin size={30} aria-hidden="true" />,
    title: '4. 무대 네 귀퉁이를 눌러요',
    lines: [
      '화면 위 노란 띠가 몇 번을 눌러야 하는지 알려 줘요.',
      '① 무대 뒤 왼쪽 → ② 무대 뒤 오른쪽 → ③ 무대 앞 오른쪽 → ④ 무대 앞 왼쪽 차례예요.',
      '손가락을 대고 있으면 돋보기가 떠서 정확하게 누를 수 있어요.',
      '다음 컷부터는 저절로 같은 무대를 써요.',
    ],
  },
  {
    icon: <Images size={30} aria-hidden="true" />,
    title: '5. 이름을 붙여요',
    lines: [
      '앱이 사람을 찾아 네모로 표시해요. 네모를 누르고 이름을 고르면 돼요.',
      '못 찾은 친구는 빈 곳을 꾹 길게 누르면 직접 넣을 수 있어요.',
      '사람이 아닌 네모는 눌러서 "사람 아니에요"로 지워요.',
      '평면도의 동그란 이름표는 끌어서 자리를 고칠 수 있어요.',
    ],
  },
  {
    icon: <PlayCircle size={30} aria-hidden="true" />,
    title: '6. 동선을 재생해요',
    lines: [
      '컷을 2개 이상 만들면 ▶ 버튼으로 동선을 볼 수 있어요.',
      '친구 이름을 누르면 그 친구만 진하게 보여요.',
      '반대쪽에서 보기를 누르면 무대 위에서 객석을 본 모습으로 바뀌어요.',
    ],
  },
  {
    icon: <Save size={30} aria-hidden="true" />,
    title: '7. 저장하고 나눠요',
    lines: [
      '따로 저장 버튼을 누르지 않아도 저절로 저장돼요.',
      '그림으로 저장 — 평면도를 그림(PNG)으로 내려받아요.',
      '동선표 PDF — 컷을 여러 개 모아 인쇄용 표로 만들어요.',
      '백업 파일로 저장 — 공연 전체를 파일 하나로 저장해요. 다른 기기에서 불러올 수 있어요.',
    ],
  },
]

export default function HelpPage() {
  const [showCards, setShowCards] = useState(false)

  return (
    <>
      <AppHeader backTo="/" title="사용법" />

      <main className="app-main" id="main-content">
        <section className="hero">
          <h2 className="hero-title">동선노트, 이렇게 써요</h2>
          <p className="hero-sub">
            연습 사진을 찍으면, 친구들이 무대 어디에 서 있었는지 위에서 본 그림으로 옮겨 줘요.
            <br />이 앱에서 <strong>&lsquo;컷&rsquo;</strong>은 <strong>장면 한 장</strong>을 뜻해요.
            컷을 여러 개 쌓으면 동선이 움직여요.
          </p>
        </section>

        <button
          type="button"
          className="btn btn-primary btn-big btn-block"
          onClick={() => setShowCards(true)}
        >
          <Film size={26} aria-hidden="true" />
          그림으로 보기 (3장)
        </button>

        <ol className="help-steps">
          {STEPS.map((step) => (
            <li key={step.title} className="card help-step">
              <div className="help-step-head">
                {step.icon}
                <h3>{step.title}</h3>
              </div>
              <ul>
                {step.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="notice" role="note">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>
            <strong>사진과 이름은 이 기기 안에만 있어요.</strong> 인터넷으로 어디에도 보내지
            않아요. 얼굴을 알아보지도 않아요 — 사람 모양만 찾고, 이름은 여러분이 직접 붙여요.
          </span>
        </div>

        <p className="hint privacy-line">
          더 궁금하면 화면 오른쪽 위의 <strong>?</strong> 버튼을 눌러 보세요. 그 화면에서 할 일을
          알려 줘요.
        </p>

        <Link className="btn btn-ghost" to="/">
          첫 화면으로 가기
        </Link>
      </main>

      {showCards && <Onboarding onClose={() => setShowCards(false)} />}
    </>
  )
}
