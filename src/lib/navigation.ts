import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Cut } from '../db/types'

/**
 * 컷을 열 때 갈 화면.
 * 사진이 없거나 무대 영역을 이미 정했으면 바로 이름 붙이기(평면도)로 간다.
 * (사진 없는 컷은 무대 네 귀퉁이를 정할 수 없으므로 무대 영역 화면으로 보내면 빈 화면이 된다)
 */
export function cutPath(projectId: string, cut: Pick<Cut, 'id' | 'stageCorners' | 'imageBlob'>) {
  return cut.stageCorners || !cut.imageBlob
    ? `/project/${projectId}/cut/${cut.id}/people`
    : `/project/${projectId}/cut/${cut.id}/stage`
}

/**
 * 방문한 화면 기록 (브라우저 기록 칸 번호 → 주소).
 * '뒤로'를 눌렀을 때 이미 지나온 화면이면 새로 쌓지 않고 기록을 거슬러 올라가게 하려고 쓴다.
 * 그래야 기기의 뒤로 버튼을 눌러도 방금 떠난 화면으로 되돌아가는 일이 없다.
 */
const STORAGE_KEY = 'dongseon-nav-stack'
let visited: string[] = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
})()

function currentIndex(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

/** 화면이 바뀔 때마다 기록한다. 라우터 안에 한 번만 둔다. */
export function NavigationTracker() {
  const location = useLocation()
  useEffect(() => {
    const idx = currentIndex()
    if (idx === null) return
    // 새로 쌓인 칸보다 뒤에 있던 기록은 더 이상 갈 수 없으므로 버린다.
    visited = visited.slice(0, idx)
    visited[idx] = location.pathname
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visited))
    } catch {
      // 기억하지 못해도 '뒤로'는 새 화면을 여는 방식으로 동작한다.
    }
  }, [location])
  return null
}

/**
 * 정해 둔 화면으로 '뒤로' 간다.
 * 지나온 기록에 그 화면이 있으면 거기까지 거슬러 올라가고, 없으면 그 화면을 새로 연다.
 */
export function useGoBack() {
  const navigate = useNavigate()
  return useCallback(
    (to: string) => {
      const idx = currentIndex()
      if (idx !== null) {
        for (let i = idx - 1; i >= 0; i--) {
          if (visited[i] === to) {
            navigate(i - idx)
            return
          }
        }
      }
      navigate(to)
    },
    [navigate],
  )
}
