import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173, // Frontend dev server port

    /**
     * Proxy configuration:
     * When the frontend makes a request to /api/..., Vite forwards it to the backend.
     * This means during development you can use relative paths like `/api/health`
     * instead of hardcoding http://localhost:5000/api/health.
     * 
     * NOTE: We also set VITE_API_URL for explicit absolute calls (both approaches work).
     */
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for Socket.IO
      },
    },
  },
});
