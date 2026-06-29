import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${path.resolve(import.meta.dirname, 'src')}/`,
    },
  },
  test: {
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
    environment: 'jsdom',
    include: [
      'src/**/__tests__/**/*.[jt]s?(x)',
      'src/**/?(*.)+(spec|test).[tj]s?(x)',
    ],
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    maxWorkers: '50%',
  },
});
