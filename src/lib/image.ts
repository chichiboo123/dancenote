/** 사진 다루기 도우미 */

/** 저장·인식에 쓰기 좋은 크기. 긴 변을 이 길이로 줄인다. */
const MAX_SIDE = 1600

/**
 * 고른 사진을 적당한 크기로 줄여서 저장한다.
 * - 태블릿 사진은 그대로 두면 너무 커서 저장소가 금방 찬다.
 * - 아이폰 사진처럼 회전 정보가 있는 사진도 똑바로 세워 준다.
 */
export async function prepareImage(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.88),
  )
  if (!blob) throw new Error('사진을 저장할 수 없어요.')
  return { blob, width, height }
}

/** Blob을 <img> 요소로 읽어 온다. (Konva에 그대로 넣을 수 있다) */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      // 다 그린 뒤 주소를 지우면 화면이 깜빡이므로, 이미지가 살아있는 동안 유지한다.
      img.dataset.objectUrl = url
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('사진을 열 수 없어요.'))
    }
    img.src = url
  })
}

/** loadImage로 만든 이미지를 다 썼을 때 메모리를 돌려준다. */
export function releaseImage(img: HTMLImageElement | null) {
  const url = img?.dataset.objectUrl
  if (url) URL.revokeObjectURL(url)
}
