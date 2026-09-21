import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages(https://<user>.github.io/dancenote/)에 올리기 때문에 base 경로가 필요하다.
// 다른 경로에 배포할 때는 VITE_BASE 환경변수로 덮어쓴다.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/dancenote/',
  plugins: [react()],
})
