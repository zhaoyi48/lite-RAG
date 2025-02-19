import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    include: [
      'pdfjs-dist',
      'pdfjs-dist/build/pdf.worker.mjs'
    ]
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/]
    }
  }
})
