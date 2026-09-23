import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages(https://<user>.github.io/dancenote/)에 올리기 때문에 base 경로가 필요하다.
// 다른 경로에 배포할 때는 VITE_BASE 환경변수로 덮어쓴다.
const base = process.env.VITE_BASE ?? '/dancenote/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 앱 껍데기만 미리 담아 둔다.
      // 사람 인식 파일(wasm·모델)은 30MB나 되어서, 아래 runtimeCaching으로
      // 실제로 한 번 쓸 때(또는 '오프라인 준비' 버튼을 누를 때) 담는다.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 글꼴 조각(약 120개)은 실제로 쓰는 글자의 조각만 받아서 담는다.
        globIgnores: ['models/**', 'assets/PretendardGOV*'],
        navigateFallbackDenylist: [/^\/models\//],
        runtimeCaching: [
          {
            // 사람 인식용 wasm과 모델 — 한 번 받으면 계속 쓴다.
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'dongseon-models',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 글꼴 조각 — 한 번 쓴 조각은 담아 두어 오프라인에서도 글씨가 예쁘다.
            urlPattern: ({ url }) => /\/assets\/PretendardGOV[^/]*\.woff2$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'dongseon-fonts',
              expiration: { maxEntries: 140, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: '동선노트',
        short_name: '동선노트',
        description: '뮤지컬 연습 장면을 무대 평면도 동선으로 기록하는 교실용 앱',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#F5F7FB',
        theme_color: '#F5F7FB',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
