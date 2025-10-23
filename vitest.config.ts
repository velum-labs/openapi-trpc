import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.vitest.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'lib/**',
        'lib-commonjs/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-*.{js,ts}',
      ],
    },
  },
})
