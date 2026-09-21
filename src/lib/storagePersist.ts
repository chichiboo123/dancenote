/**
 * 브라우저에게 "이 앱 자료는 함부로 지우지 말아 주세요"라고 부탁한다.
 * 저장 공간이 부족할 때 자동으로 지워지는 것을 막아 준다. (허락 여부는 브라우저가 정한다)
 */
export async function askPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** 지금 쓰고 있는 저장 공간을 알려 준다. (설정 화면 안내용) */
export async function storageUsage(): Promise<{ usedMB: number; quotaMB: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usedMB: usage / 1024 / 1024, quotaMB: quota / 1024 / 1024 }
  } catch {
    return null
  }
}
