import type { ElectronAPI } from '@/types/electron'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
