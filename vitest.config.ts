import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{ts,mts,js,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/tests/']
    },
    alias: {
      '@': resolve(__dirname, './src/renderer'),
      '@main': resolve(__dirname, './src/main')
    }
  }
})
