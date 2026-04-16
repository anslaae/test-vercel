import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev: Vercel functions are served at port 3000 when you run `vercel dev`
const VERCEL_DEV = process.env.VERCEL_DEV_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Auth endpoints are handled by dedicated serverless functions
      '/api/auth-login':    { target: VERCEL_DEV, changeOrigin: true },
      '/api/auth-callback': { target: VERCEL_DEV, changeOrigin: true },
      '/api/auth-session':  { target: VERCEL_DEV, changeOrigin: true },
      '/api/auth-session-details': { target: VERCEL_DEV, changeOrigin: true },
      '/api/auth-logout':   { target: VERCEL_DEV, changeOrigin: true },

      // All other /api/* calls go through the BFF proxy function
      '/api': { target: VERCEL_DEV, changeOrigin: true }
    }
  }
});
