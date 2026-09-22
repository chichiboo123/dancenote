import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Pause,
  Play,
  Rabbit,
  Snail,
} from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import { db } from '../db/db'
import { createCutFromVideoFrame, formatTime } from '../db/repo'
import { prepareImage } from '../lib/image'
import { warmUpDetector } from '../lib/detector'
import type { Cut } from '../db/types'

/** 한 프레임 앞뒤로 움직일 때 쓰는 시간 (보통 영상은 1초에 30장) */
const FRAME = 1 / 30

export default function VideoPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [slow, setSlow] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [madeCutIds, setMadeCutIds] = useState<string[]>([])

  const cuts = useLiveQuery(
    () => db.cuts.where('projectId').equals(id).sortBy('order'),
    [id],
    [] as Cut[],
  )

  // 이 공연에서 지난번에 쓰던 영상 파일 이름
  const lastFileName = useMemo(() => {
    for (let i = cuts.length - 1; i >= 0; i--) {
      if (cuts[i].video?.fileName) return cuts[i].video!.fileName
    }
    return null
  }, [cuts])

  const videoCuts = useMemo(() => cuts.filter((c) => c.video), [cuts])

  useEffect(() => {
    warmUpDetector()
  }, [])

  // 영상 주소는 다 쓰면 돌려준다.
  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  function handlePick(file: File | undefined) {
    if (!file) return
    setFailed(false)
    setPlaying(false)
    setTime(0)
    setDuration(0)
    setFileName(file.name)
    setObjectUrl(URL.createObjectURL(file))
  }

  const seek = useCallback((to: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.min(video.duration || 0, Math.max(0, to))
  }, [])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => setFailed(true))
    } else {
      video.pause()
    }
  }

  /** 지금 화면을 컷으로 만든다. */
  async function captureFrame() {
    const video = videoRef.current
    if (!video || !fileName) return
    if (!video.videoWidth) {
      toast.error('아직 영상이 준비되지 않았어요. 잠시 뒤에 다시 눌러 주세요.')
      return
    }
    video.pause()
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const raw = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      )
      if (!raw) throw new Error('장면을 저장할 수 없어요.')

      const prepared = await prepareImage(raw)
      const cutId = await createCutFromVideoFrame(id, prepared, {
        fileName,
        timeSec: video.currentTime,
      })
      setMadeCutIds((prev) => [...prev, cutId])
      toast.success(`${formatTime(video.currentTime)} 장면을 기록했어요!`)
    } catch (err) {
      console.error(err)
      toast.error('장면을 기록하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const readyToEdit = madeCutIds.length > 0

  return (
    <>
      <AppHeader
        backTo={`/project/${id}/cut/new`}
        title="영상에서 컷 만들기"
        help={{
          title: '영상은 이렇게 써요',
          body: (
            <>
              <p>
                영상을 고르고 재생하다가, 기록하고 싶은 장면에서 <strong>멈춤</strong>을 누르세요.
              </p>
              <p>
                <strong>◀ ▶ 한 장면씩</strong> 버튼으로 딱 맞는 순간을 찾고,
                <strong> 이 장면 기록하기</strong>를 누르면 컷이 만들어져요.
              </p>
              <p>
                영상 파일은 기기에 저장하지 않아요(너무 커서요). 대신 <strong>파일 이름과 시각</strong>
                만 적어 두고, 다음에 같은 파일을 다시 고르면 그 장면으로 바로 갈 수 있어요.
              </p>
            </>
          ),
        }}
      />

      <main className="app-main work-main" id="main-content">
        {!objectUrl ? (
          <>
            <div className="guide-bar" role="status">
              <Film size={24} aria-hidden="true" />
              <span>연습 영상을 골라 주세요.</span>
            </div>

            {lastFileName && (
              <div className="notice" role="note">
                <Clock size={22} aria-hidden="true" />
                <span>
                  지난번에는 <strong>{lastFileName}</strong> 영상을 썼어요. 같은 파일을 고르면 기록해
                  둔 장면으로 바로 갈 수 있어요.
                </span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-big btn-block"
              onClick={() => pickRef.current?.click()}
            >
              <Film size={28} aria-hidden="true" />
              영상 고르기
            </button>
          </>
        ) : (
          <>
            <div className="guide-bar" role="status">
              <Camera size={24} aria-hidden="true" />
              <span>
                기록하고 싶은 장면에서 멈추고 <strong>이 장면 기록하기</strong>를 누르세요.
              </span>
            </div>

            {failed ? (
              <div className="notice" role="alert">
                <Film size={22} aria-hidden="true" />
                <span>
                  <strong>이 영상은 이 브라우저에서 열 수 없어요.</strong>
                  <br />
                  아이폰·아이패드로 찍은 영상이면 <strong>설정 → 카메라 → 포맷 → &lsquo;호환성
                  우선&rsquo;</strong>으로 바꾼 뒤 다시 찍어 주세요. 이미 찍은 영상은 사진 앱에서
                  내보낼 때 &lsquo;가장 호환성 높게&rsquo;를 고르면 돼요.
                  <br />
                  아니면 그 장면을 사진으로 찍어 <strong>사진 올리기</strong>로 넣어도 괜찮아요.
                </span>
              </div>
            ) : (
              <div className="video-box">
                <video
                  ref={videoRef}
                  src={objectUrl}
                  className="video-player"
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onSeeked={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onError={() => setFailed(true)}
                />
              </div>
            )}

            {!failed && (
              <>
                <div className="play-bar">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      videoRef.current?.pause()
                      seek(time - FRAME)
                    }}
                    aria-label="한 장면 뒤로"
                    title="한 장면 뒤로"
                  >
                    <ChevronLeft size={24} aria-hidden="true" />
                    <span className="frame-label">한 장면</span>
                  </button>

                  <button type="button" className="btn btn-primary play-button" onClick={togglePlay}>
                    {playing ? (
                      <>
                        <Pause size={24} aria-hidden="true" />
                        멈춤
                      </>
                    ) : (
                      <>
                        <Play size={24} aria-hidden="true" />
                        재생
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      videoRef.current?.pause()
                      seek(time + FRAME)
                    }}
                    aria-label="한 장면 앞으로"
                    title="한 장면 앞으로"
                  >
                    <span className="frame-label">한 장면</span>
                    <ChevronRight size={24} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={`btn btn-ghost${slow ? ' is-on' : ''}`}
                    onClick={() => {
                      const next = !slow
                      setSlow(next)
                      if (videoRef.current) videoRef.current.playbackRate = next ? 0.5 : 1
                    }}
                    aria-pressed={slow}
                  >
                    {slow ? (
                      <Snail size={22} aria-hidden="true" />
                    ) : (
                      <Rabbit size={22} aria-hidden="true" />
                    )}
                    {slow ? '0.5배속' : '보통 속도'}
                  </button>

                  <span className="video-time">
                    {formatTime(time)} / {formatTime(duration)}
                  </span>

                  <input
                    className="slider play-slider"
                    type="range"
                    min={0}
                    max={Math.max(0.01, duration)}
                    step={0.01}
                    value={time}
                    onChange={(e) => {
                      videoRef.current?.pause()
                      seek(Number(e.target.value))
                    }}
                    aria-label="영상 위치"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-big btn-block"
                  onClick={captureFrame}
                  disabled={busy}
                >
                  <Camera size={26} aria-hidden="true" />
                  {busy ? '기록하는 중이에요…' : '이 장면 기록하기'}
                </button>
              </>
            )}

            {videoCuts.length > 0 && (
              <section className="timeline-wrap">
                <h2 className="section-title">이 영상에서 기록한 장면</h2>
                <ul className="video-cut-list">
                  {videoCuts.map((cut) => {
                    const sameFile = cut.video?.fileName === fileName
                    return (
                      <li key={cut.id}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            if (!sameFile) {
                              toast(
                                `이 장면은 '${cut.video?.fileName}' 영상에서 기록했어요. 같은 파일을 골라 주세요.`,
                              )
                              return
                            }
                            videoRef.current?.pause()
                            seek(cut.video!.timeSec)
                          }}
                          disabled={failed}
                        >
                          <Clock size={20} aria-hidden="true" />
                          {cut.title}
                          {!sameFile && <span className="hint"> (다른 영상)</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <div className="toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => pickRef.current?.click()}
              >
                <Film size={22} aria-hidden="true" />
                다른 영상 고르기
              </button>
            </div>

            {readyToEdit && (
              <button
                type="button"
                className="btn btn-primary btn-big btn-block next-btn"
                onClick={() => navigate(`/project/${id}/cut/${madeCutIds[0]}/stage`)}
              >
                {madeCutIds.length}개 기록했어요 — 무대 영역 정하러 가기
              </button>
            )}
          </>
        )}

        <input
          ref={pickRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => {
            handlePick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </main>
    </>
  )
}
