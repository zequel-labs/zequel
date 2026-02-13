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
    plugins: [externalizeDepsPlugin({ exclude: ['archiver'] })],
    build: {
      rollupOptions: {
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
