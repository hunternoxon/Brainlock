import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Brainlock',
        short_name: 'Brainlock',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        additionalManifestEntries: [{ url: '/data/brainlock_dataset.json', revision: null }, { url: '/data/obstacles.json', revision: null }]
      }
    })
  ],
  server: {
    port: 5173
  }
})
