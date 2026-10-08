import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use the shared package's TypeScript source directly (ESM) instead of its CommonJS build.
    alias: { '@m63/shared': path.resolve(__dirname, '../backend/shared/src/index.ts') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], motion: ['framer-motion'] } } }
  }
});
