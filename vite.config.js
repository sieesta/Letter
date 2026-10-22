import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: In sandboxed / restricted environments `os.networkInterfaces()` throws
// (uv_interface_addresses -> EACCES). Vite only calls it when the host is a
// wildcard (0.0.0.0 / ::). Binding to the loopback address skips that call
// entirely, so the dev server boots reliably.
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT) || 5173

export default defineConfig({
  plugins: [react()],
  server: {
    host: HOST,
    port: PORT,
    strictPort: true,
    // Reach the dev server from a phone on the same wifi:
    //   npm run dev:lan
    // (only works where network interfaces are readable)
  },
  preview: {
    host: HOST,
    port: PORT + 1,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
