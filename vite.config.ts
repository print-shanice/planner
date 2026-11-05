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
  // maplibre is one ~900 kB chunk, loaded only when a map is shown
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'countries-110m.geojson'],
      manifest: {
        name: 'planner',
        short_name: 'planner',
        theme_color: '#F4F3EF',
        background_color: '#F4F3EF',
        display: 'standalone',
        start_url: '/planner/',
        scope: '/planner/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,geojson,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(styles|fonts|sprites)\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map-style' },
          },
          {
            // map tiles already seen stay available offline
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/planet\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
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
