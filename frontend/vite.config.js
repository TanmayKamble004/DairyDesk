import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Listen on all interfaces so the published port works when containerised.
    host: true,
    // Bind-mounted files don't emit inotify events on Windows/WSL2, so HMR
    // needs polling in Docker. Off by default for host-native `npm run dev`.
    watch: { usePolling: !!process.env.VITE_USE_POLLING },
    // Only needed if the container's port is remapped on the host.
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) }
      : undefined,
  },
})
