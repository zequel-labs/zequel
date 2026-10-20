import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: ['archiver', 'stream-json', 'stream-chain'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // Loaded by path from row-transfer-context.ts, so it must keep this name next to index.js.
          'sqlite-rows-worker': resolve('src/main/services/row-transfer-sqlite-worker.ts')
        },
        external: ['better-sqlite3', 'keytar']
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        'web-worker': resolve('src/renderer/lib/stubs/web-worker.ts')
      }
    },
    plugins: [vue(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'monaco-editor': ['monaco-editor'],
            'vue-flow': [
              '@vue-flow/core',
              '@vue-flow/background',
              '@vue-flow/controls',
              '@vue-flow/minimap',
              'elkjs'
            ],
            'data-grid': ['@tanstack/vue-table', '@tanstack/vue-virtual']
          }
        }
      }
    }
  }
})
