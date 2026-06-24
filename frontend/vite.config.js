import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api/* requests to the backend so we don't get CORS errors in dev
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
