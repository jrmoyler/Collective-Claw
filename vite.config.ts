import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // loadEnv reads from .env files for local dev; process.env picks up
  // Vercel-injected environment variables during CI/CD builds.
  const env = loadEnv(mode, '.', '');
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Injected at build time — visible in the client bundle.
      // Set GEMINI_API_KEY in the Vercel environment variables dashboard.
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // Raise the warning limit slightly; three.js + baked animation data is large.
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['three'],
    },
  };
});
