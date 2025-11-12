import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Optionally specify server port to match redirect URI
  server: { port: 5173 }
});
