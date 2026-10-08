import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ command, mode }) => {
  // On Vercel the frontend and backend are separate deployments, so a build without the backend origin would
  // silently send every /api/v1 request to the frontend's own domain (404). Fail the deploy instead.
  const apiUrl = loadEnv(mode, __dirname, 'VITE_').VITE_API_URL ?? '';
  if (command === 'build' && process.env.VERCEL && !apiUrl.trim()) {
    throw new Error(`VITE_API_URL is not set for this Vercel build (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unknown'}). Add it to the frontend project for this environment and redeploy.`);
  }
  return {
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
};
});
