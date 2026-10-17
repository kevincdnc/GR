import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    rollupOptions: {
      input: {
        // l'éditeur
        main: resolve(import.meta.dirname, 'index.html'),
        // la page d'impression ouverte par le moteur d'export (Chromium headless)
        render: resolve(import.meta.dirname, 'render.html'),
      },
    },
  },
})
