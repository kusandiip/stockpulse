import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend URL — override via VITE_API_URL env if needed
  // Defaults to 8002 because port 8000 is taken by JARVIQ on this machine
  const backend = env.VITE_API_URL || 'http://localhost:8002'
  const wsBackend = backend.replace(/^http/, 'ws')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/ws':  { target: wsBackend, ws: true },
      },
    },
    build: { outDir: 'dist', sourcemap: false },
  }
})
