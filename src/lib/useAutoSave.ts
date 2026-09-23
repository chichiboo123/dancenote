import { useEffect, useRef } from 'react'

/**
 * 값이 바뀌면 잠시 뒤 자동으로 저장한다.
 * 저장 버튼을 누르기 전에 화면을 떠나도 작업이 날아가지 않게 하기 위한 것이다.
 * 기다리는 동안 화면을 떠나면(뒤로 가기 등) 그 자리에서 바로 저장한다.
 */
export function useAutoSave<T>(value: T, save: (value: T) => void | Promise<void>, delay = 800) {
  const saveRef = useRef(save)
  const firstRun = useRef(true)
  // 아직 저장하지 못하고 기다리는 값
  const pendingRef = useRef<{ value: T } | null>(null)

  // 저장 함수는 매번 새로 만들어지므로, 최신 것을 따로 담아 둔다.
  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    // 처음 그릴 때는 저장하지 않는다. (불러온 값을 그대로 다시 쓰는 셈이라 의미가 없다)
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    pendingRef.current = { value }
    const timer = window.setTimeout(() => {
      pendingRef.current = null
      void saveRef.current(value)
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  // 화면을 떠날 때 기다리던 저장이 있으면 바로 해 둔다.
  useEffect(
    () => () => {
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) void saveRef.current(pending.value)
    },
    [],
  )
}
