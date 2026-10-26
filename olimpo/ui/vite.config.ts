import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/olimpo/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/olimpo/auth': { target: 'http://localhost:3110', changeOrigin: true },
      '/olimpo/impostazioni': { target: 'http://localhost:3110', changeOrigin: true },
      '/olimpo/foto': { target: 'http://localhost:3110', changeOrigin: true },
      '/olimpo/materiali': { target: 'http://localhost:3110', changeOrigin: true },
    },
  },
  build: {
    outDir: '../private-ui',
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
