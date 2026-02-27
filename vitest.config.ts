import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@sync-engine': resolve(__dirname, 'src/sync-engine'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/renderer/**', 'src/**/index.ts', '**/*.d.ts'],
    },
    testTimeout: 10000,
    pool: 'forks',
  },
})
