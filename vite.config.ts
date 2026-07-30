import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  // @xenova/transformers uses dynamic import() internally to pick its ONNX
  // Runtime backend -- Vite's default IIFE worker output doesn't support
  // that, so the whisper transcription worker needs ES module output.
  worker: {
    format: 'es'
  }
})
