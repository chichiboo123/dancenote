import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { markOnboardingSeen } from '../lib/onboardingSeen'

const CARDS = [
  {
    title: '① 연습 장면을 찍어요',
    body: '무대가 다 보이게 사진을 찍거나, 찍어 둔 사진·영상을 올려요.',
    art: <ArtCamera />,
  },
  {
    title: '② 무대 네 귀퉁이를 눌러요',
    body: '사진 속 무대의 네 모서리를 번호 순서대로 톡톡 눌러요. 딱 한 번만 하면 돼요.',
    art: <ArtCorners />,
  },
  {
    title: '③ 이름을 붙이면 동선이 생겨요',
    body: '찾아낸 사람을 누르고 이름을 골라요. 컷을 여러 개 쌓으면 동선이 움직여요!',
    art: <ArtRoute />,
  },
]

/** 3장짜리 그림 안내 (건너뛰기 가능) */
export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const card = CARDS[index]
  const last = index === CARDS.length - 1

  function finish() {
    markOnboardingSeen()
    onClose()
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="처음 쓰는 사람을 위한 안내">
      <div className="onboarding-box">
        <div className="onboarding-art">{card.art}</div>
        <h2>{card.title}</h2>
        <p>{card.body}</p>

        <div className="onboarding-dots" aria-hidden="true">
          {CARDS.map((c, i) => (
            <span key={c.title} className={i === index ? 'is-on' : ''} />
          ))}
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIndex((i) => i - 1)}
            disabled={index === 0}
          >
            <ChevronLeft size={22} aria-hidden="true" />
            앞으로
          </button>

          {last ? (
            <button type="button" className="btn btn-primary btn-big" onClick={finish}>
              시작할래요!
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-big"
              onClick={() => setIndex((i) => i + 1)}
            >
              다음
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          )}
        </div>

        <button type="button" className="onboarding-skip" onClick={finish}>
          건너뛰기
        </button>
      </div>
    </div>
  )
}

/* ---- 그림 세 장 (간단한 SVG) ---- */

function ArtCamera() {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="무대를 사진으로 찍는 모습">
      <rect width="240" height="150" rx="14" fill="#FFF1D9" />
      <path d="M60 110 L90 60 L160 60 L190 110 Z" fill="#F1D9B5" stroke="#C2AB86" strokeWidth="3" />
      <circle cx="105" cy="82" r="8" fill="#FF6B4A" stroke="#fff" strokeWidth="3" />
      <circle cx="140" cy="80" r="8" fill="#3CC7A8" stroke="#fff" strokeWidth="3" />
      <rect x="92" y="14" width="58" height="36" rx="8" fill="#1F2A44" />
      <circle cx="121" cy="32" r="12" fill="#FFD23F" stroke="#fff" strokeWidth="3" />
      <rect x="104" y="8" width="20" height="8" rx="4" fill="#1F2A44" />
    </svg>
  )
}

function ArtCorners() {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="무대 네 귀퉁이를 차례로 누르는 모습">
      <rect width="240" height="150" rx="14" fill="#FFF1D9" />
      <path
        d="M70 45 L170 45 L200 118 L40 118 Z"
        fill="#F1D9B5"
        stroke="#FFD23F"
        strokeWidth="4"
        strokeDasharray="9 7"
      />
      {[
        [70, 45, '1'],
        [170, 45, '2'],
        [200, 118, '3'],
        [40, 118, '4'],
      ].map(([cx, cy, n]) => (
        <g key={n as string}>
          <circle cx={cx as number} cy={cy as number} r="15" fill="#FF6B4A" stroke="#fff" strokeWidth="4" />
          <text
            x={cx as number}
            y={(cy as number) + 6}
            textAnchor="middle"
            fill="#fff"
            fontSize="17"
            fontFamily="Jua, sans-serif"
          >
            {n}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ArtRoute() {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="평면도 위에서 이름표가 움직이는 모습">
      <rect width="240" height="150" rx="14" fill="#FFF1D9" />
      <rect x="28" y="24" width="184" height="102" rx="8" fill="#F1D9B5" stroke="#C2AB86" strokeWidth="3" />
      <path
        d="M70 96 C 110 96, 120 50, 170 52"
        fill="none"
        stroke="#1F2A44"
        strokeWidth="3"
        strokeDasharray="6 7"
        strokeLinecap="round"
      />
      <circle cx="70" cy="96" r="19" fill="#E69F00" stroke="#fff" strokeWidth="4" />
      <text x="70" y="103" textAnchor="middle" fill="#1A1A1A" fontSize="16" fontFamily="Jua, sans-serif">
        서준
      </text>
      <circle cx="172" cy="52" r="19" fill="#0072B2" stroke="#fff" strokeWidth="4" />
      <text x="172" y="59" textAnchor="middle" fill="#fff" fontSize="16" fontFamily="Jua, sans-serif">
        하윤
      </text>
    </svg>
  )
}
