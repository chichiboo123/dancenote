import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Film, Images, Loader2, PencilRuler } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import { createBlankCut, createCutsFromImages } from '../db/repo'
import { prepareImage } from '../lib/image'
import { warmUpDetector } from '../lib/detector'

export default function NewCutPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // 사진을 고르는 동안 사람 찾기 도구를 미리 준비해 둔다. (처음 한 번이 오래 걸린다)
  useEffect(() => {
    warmUpDetector()
  }, [])

  async function handleFiles(files: FileList | null, source: 'camera' | 'photo') {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const prepared = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        prepared.push(await prepareImage(file))
      }
      if (prepared.length === 0) {
        toast.error('사진 파일이 아니에요. 사진을 골라 주세요.')
        return
      }
      const ids = await createCutsFromImages(id, prepared, source)
      toast.success(
        prepared.length === 1 ? '사진을 가져왔어요!' : `사진 ${prepared.length}장을 가져왔어요!`,
      )
      navigate(`/project/${id}/cut/${ids[0]}/stage`)
    } catch (err) {
      console.error(err)
      toast.error('사진을 여는 데 실패했어요. 다른 사진으로 해 볼까요?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppHeader
        backTo={`/project/${id}`}
        title="컷 기록하기"
        help={{
          title: '어떤 걸 고르면 돼요?',
          body: (
            <>
              <p>
                <strong>사진 찍기</strong> — 지금 바로 연습 장면을 찍어요. 무대 전체가 다 보이게
                찍는 게 좋아요.
              </p>
              <p>
                <strong>사진 올리기</strong> — 이미 찍어 둔 사진을 골라요. 여러 장을 한 번에 고르면
                고른 순서대로 컷이 만들어져요.
              </p>
            </>
          ),
        }}
      />

      <main className="app-main" id="main-content">
        <ol className="steps">
          <li className="done">
            <span className="step-no">1</span> 공연 만들기
          </li>
          <li className="done">
            <span className="step-no">2</span> 명단 넣기
          </li>
          <li aria-current="step">
            <span className="step-no">3</span> 컷 기록하기
          </li>
        </ol>

        <h2 className="section-title">장면을 어떻게 가져올까요?</h2>

        {busy ? (
          <div className="empty">
            <Loader2 size={44} className="spin" aria-hidden="true" />
            <p>사진을 여는 중이에요…</p>
          </div>
        ) : (
          <div className="big-actions">
            <button type="button" className="big-action" onClick={() => cameraRef.current?.click()}>
              <Camera size={40} aria-hidden="true" />
              <strong>사진 찍기</strong>
              <span>지금 바로 찍어요</span>
            </button>

            <button type="button" className="big-action" onClick={() => pickRef.current?.click()}>
              <Images size={40} aria-hidden="true" />
              <strong>사진 올리기</strong>
              <span>여러 장 한꺼번에 가능</span>
            </button>

            <button
              type="button"
              className="big-action"
              onClick={() => navigate(`/project/${id}/video`)}
            >
              <Film size={40} aria-hidden="true" />
              <strong>영상 올리기</strong>
              <span>보다가 장면을 골라요</span>
            </button>

            <button
              type="button"
              className="big-action"
              onClick={async () => {
                const cutId = await createBlankCut(id)
                toast.success('빈 컷을 만들었어요. 평면도에서 친구를 놓아 보세요!')
                navigate(`/project/${id}/cut/${cutId}/people`)
              }}
            >
              <PencilRuler size={40} aria-hidden="true" />
              <strong>사진 없이 짜기</strong>
              <span>평면도에 직접 놓아요</span>
            </button>
          </div>
        )}

        <div className="notice" role="note">
          <Camera size={22} aria-hidden="true" />
          <span>
            무대 <strong>네 귀퉁이가 모두 보이게</strong> 찍으면 평면도가 훨씬 정확해져요. 삼각대에
            올려 두고 찍으면 무대 영역을 한 번만 정하면 돼요. 연습 전에 동선을 미리 짜려면
            <strong> 사진 없이 짜기</strong>를 쓰세요.
          </span>
        </div>

        {/* 태블릿에서 가장 잘 동작하는 방식 */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files, 'camera')
            e.target.value = ''
          }}
        />
        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files, 'photo')
            e.target.value = ''
          }}
        />
      </main>
    </>
  )
}
