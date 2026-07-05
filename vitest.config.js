import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 90,
        lines: 90
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'eslint.config.js',
        'vitest.config.js',
        'playwright.config.js',
        'frontend/vite.config.js'
      ]
    }
  }
});
