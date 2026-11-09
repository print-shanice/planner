/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { configProblem } from './src/lib/config'

// refuse to build a public site around a secret key or a key pasted into the url field
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const problem = url || key ? configProblem(url, key) : null
if (problem === 'secret') throw new Error('VITE_SUPABASE_ANON_KEY is a secret key. Use the publishable key.')
if (problem === 'url') throw new Error('VITE_SUPABASE_URL is not the project URL (https://<ref>.supabase.co).')

export default defineConfig({
  base: '/planner/',
  // always the same address, so the google key's allowed sites can name it (and it never drifts to another port)
  server: { port: 5180, strictPort: true },
  // maplibre is one ~900 kB chunk, loaded only for the home globe
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'countries-110m.geojson'],
      manifest: {
        name: 'planner',
        short_name: 'planner',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/planner/',
        scope: '/planner/',
        // android (chrome) lists the installed planner in its share sheet; ios safari doesn't support this,
        // so iphones use the "save to planner" shortcut instead. the shared link lands on /planner/?url=…
        share_target: { action: '/planner/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,gif,woff2,geojson,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // google maps (the trip map, search, routes) is never cached by the planner: it needs a connection,
        // and google's terms don't allow keeping its tiles or answers
        runtimeCaching: [
          {
            // the globe's detailed coastlines, place names and lettering load the first time someone zooms in, then stay offline
            urlPattern: /\/globe\/.+\.(json|pbf)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'globe', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
