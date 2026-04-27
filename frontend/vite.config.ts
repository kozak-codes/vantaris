import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  root: '.',
  server: {
    open: true,
  },
  plugins: [preact() as any],
  resolve: {
    alias: {
      '@vantaris/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
  },
});