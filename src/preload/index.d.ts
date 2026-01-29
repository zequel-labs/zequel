import type { ElectronAPI } from '../renderer/types/electron'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
