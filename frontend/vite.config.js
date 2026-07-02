import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces
    allowedHosts: true, // Allow any host (localtunnel subdomains, ngrok, etc.) to bypass DNS rebinding checks
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});
