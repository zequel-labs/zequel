import type { ElectronAPI, ElectronIpcRenderer } from '@/types/electron'

declare global {
  interface Window {
    api: ElectronAPI
    electron?: {
      ipcRenderer: ElectronIpcRenderer
    }
  }
}
