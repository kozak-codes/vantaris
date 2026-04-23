import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  server: {
    open: true,
  },
  resolve: {
    alias: {
      '@vantaris/shared/constants': path.resolve(__dirname, '../shared/src/constants.ts'),
      '@vantaris/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});