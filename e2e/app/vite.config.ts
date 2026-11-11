import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// serves the real src/ with supabase swapped for the in-memory stand-in and a pretend google key,
// so the planner can be opened (and tested) without an account or any keys
const src = path.resolve(__dirname, '../../src')

export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(__dirname, '../../public'),
  plugins: [react(), {
    name: 'fake-supabase', enforce: 'pre',
    resolveId(id, importer) {
      if (importer && /\/supabase$/.test(id) && importer.startsWith(src)) return path.resolve(__dirname, 'fake-supabase.ts')
    },
  }],
  define: { 'import.meta.env.VITE_GOOGLE_MAPS_KEY': JSON.stringify(process.env.FAKE_GOOGLE === '0' ? '' : 'fake') },
  server: { port: 5310, strictPort: true, fs: { allow: ['../..'] } },
  // the tests run against a built copy served still: no compiling on first open, no hot-reload socket to drop when a test goes offline
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1000 },
  preview: { port: 5310, strictPort: true },
})
