import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/__tests__/setup.ts'],
    include: [
      'server/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'lib/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // Client: i .test.ts girano in node; i .test.tsx dichiarano in testa
      // `// @vitest-environment jsdom` (vitest 4 non ha environmentMatchGlobs)
      'src/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'server/__tests__/',
        'server/**/*.d.ts',
        'server/**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@server': resolve(__dirname, './server'),
      '@': resolve(__dirname, './src')
    }
  }
}) 