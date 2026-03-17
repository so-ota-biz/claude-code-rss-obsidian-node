import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75
      }
    }
  }
});
