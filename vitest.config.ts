import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname);

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'backend/**/*.test.ts'],
  },
  resolve: {
    conditions: ['import', 'node', 'default'],
    alias: [
      { find: '@vantaris/shared', replacement: resolve(root, 'shared/src/index.ts') },
    ],
  },
});