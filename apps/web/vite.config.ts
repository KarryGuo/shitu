import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      // 任务闭环 API → 本地 Fastify（pnpm dev:api，端口 8787）
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
