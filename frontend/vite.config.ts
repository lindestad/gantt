import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      // Using polling improves reliability with Docker volume mounts on Windows (dev only)
      usePolling: true,
      interval: 200
    }
  }
})
