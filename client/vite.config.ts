import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le frontend appelle le backend sur le port 3001 en développement.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
