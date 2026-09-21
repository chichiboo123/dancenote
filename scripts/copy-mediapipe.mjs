/**
 * MediaPipe의 wasm 파일을 public/models/wasm/ 으로 복사한다.
 * 외부 CDN 없이(=오프라인에서도) 사람 인식이 돌아가게 하기 위한 것이고,
 * 용량이 커서 저장소에는 넣지 않고 npm install 때마다 node_modules에서 가져온다.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const to = join(root, 'public', 'models', 'wasm')

// SIMD를 지원하는 기기용과, 지원하지 않는 옛 기기용 두 벌이 모두 필요하다.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

if (!existsSync(from)) {
  console.warn('[copy-mediapipe] @mediapipe/tasks-vision 가 아직 설치되지 않았어요. 건너뜁니다.')
  process.exit(0)
}

mkdirSync(to, { recursive: true })
for (const name of FILES) {
  copyFileSync(join(from, name), join(to, name))
}
console.log(`[copy-mediapipe] wasm 파일 ${FILES.length}개를 public/models/wasm/ 에 넣었어요.`)
