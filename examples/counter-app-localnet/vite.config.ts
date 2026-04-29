import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v2': {
        target: 'http://localhost:6864',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
