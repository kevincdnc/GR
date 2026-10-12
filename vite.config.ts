import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gr34Stages } from './vite-plugin-gpx'

export default defineConfig({
  // Chemins relatifs : l'app fonctionne sur n'importe quel hébergeur statique (GitHub Pages, Netlify…)
  base: './',
  plugins: [react(), gr34Stages()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // La preview (scripts/build-preview.mjs) veut un seul fichier : pas de découpage
        manualChunks: process.env.GR34_PREVIEW ? undefined : (id) => {
          if (id.includes('gr34-stages')) return 'stages'
          if (id.includes('node_modules/leaflet') || id.includes('react-leaflet')) return 'leaflet'
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
        },
      },
    },
  },
})
