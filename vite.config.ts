import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  optimizeDeps: {
    include: ['es-toolkit', 'recharts']
  },
  server: {
    port: 5847,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  preview: {
    port: 5847
  }
})
