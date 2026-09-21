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
