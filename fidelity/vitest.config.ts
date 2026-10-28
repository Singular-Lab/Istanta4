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
    // yarn test:server gira con la coverage: sotto le soglie fallisce, anche in CI.
    // Le soglie sono il livello del 2026-10-28 arrotondato per difetto: si alzano a mano
    // quando i test crescono, non si abbassano.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      // Tutti i sorgenti, anche quelli che nessun test carica: senza, la percentuale li ignora
      include: [
        'server/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'src/**/*.{ts,tsx}'
      ],
      exclude: [
        'node_modules/',
        'server/__tests__/',
        'server/**/*.d.ts',
        'server/**/index.ts',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.ts',
        '**/*.d.ts'
      ],
      thresholds: {
        lines: 26,
        statements: 26,
        functions: 22,
        branches: 22,
        'server/core/http/**': { lines: 90, statements: 85, functions: 80, branches: 80 },
        'server/core/inizializzazione/**': { lines: 90, statements: 90, functions: 90, branches: 85 },
        'server/core/agenzia_lib/**': { lines: 80, statements: 80, functions: 80, branches: 65 },
        'server/core/db/**': { lines: 75, statements: 75, functions: 75, branches: 70 },
        'server/core/accessi/**': { lines: 75, statements: 70, functions: 70, branches: 70 }
      }
    }
  },
  resolve: {
    alias: {
      '@server': resolve(__dirname, './server'),
      '@': resolve(__dirname, './src')
    }
  }
}) 