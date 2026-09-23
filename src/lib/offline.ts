/** 인터넷 없이도 쓸 수 있게, 사람 인식에 필요한 파일을 미리 받아 둔다. */

const FILES = [
  'efficientdet_lite2.tflite',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
]

export interface OfflineProgress {
  done: number
  total: number
  currentMB: number
}

/** 서비스 워커(오프라인 담당)가 켜져 있는지 */
export function offlineSupported(): boolean {
  return 'serviceWorker' in navigator && 'caches' in window
}

/**
 * 파일들을 한 번씩 받아서 브라우저 저장고에 담는다.
 * 서비스 워커가 이 요청을 가로채 저장해 두기 때문에, 다음부터는 인터넷이 없어도 쓸 수 있다.
 */
export async function prepareOffline(onProgress?: (p: OfflineProgress) => void): Promise<number> {
  const base = new URL('models/', document.baseURI).href
  let bytes = 0

  for (const [index, name] of FILES.entries()) {
    const res = await fetch(`${base}${name}`, { cache: 'reload' })
    if (!res.ok) throw new Error(`${name} 파일을 받지 못했어요.`)
    const buf = await res.arrayBuffer()
    bytes += buf.byteLength
    onProgress?.({ done: index + 1, total: FILES.length, currentMB: bytes / 1024 / 1024 })
  }

  return bytes
}

/** 이미 받아 둔 파일이 있는지 (대략적으로 확인) */
export async function isOfflineReady(): Promise<boolean> {
  if (!offlineSupported()) return false
  try {
    const cache = await caches.open('dongseon-models')
    const urls = (await cache.keys()).map((r) => r.url)
    // 모델을 바꾼 뒤에는 예전 파일이 남아 있어도 준비되지 않은 것으로 본다.
    return FILES.every((name) => urls.some((url) => url.endsWith(`/models/${name}`)))
  } catch {
    return false
  }
}
