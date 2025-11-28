import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/auth2': {
        target: 'https://api.devtest.catalystone.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[Vite Proxy - Auth]', req.method, req.url, '→', proxyReq.path);
          });
        }
      },
      '/api': {
        target: 'https://api.devtest.catalystone.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[Vite Proxy - User]', req.method, req.url, '→', proxyReq.path);
          });
        }
      }
    }
  }
});
