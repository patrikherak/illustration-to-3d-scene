import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { precache } from './precache.ts';

export default defineConfig({
  base: './',
  plugins: [react(), precache()],
  server: { fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 2000 },
});
