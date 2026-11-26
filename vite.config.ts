import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages el sitio vive en /simulador-hidrocarburos/; BASE_PATH lo define el workflow.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Simulador de carga de hidrocarburos',
        short_name: 'Simulador carga',
        description: 'Práctica de operaciones de carga de buque tanque, disponible sin conexión.',
        lang: 'es-AR',
        theme_color: '#0f1720',
        background_color: '#0f1720',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  resolve: { alias: { react: 'preact/compat', 'react-dom/client': 'preact/compat/client', 'react-dom': 'preact/compat', 'react/jsx-runtime': 'preact/jsx-runtime' } },
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
})
