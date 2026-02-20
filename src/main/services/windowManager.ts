import type { BrowserWindow } from 'electron'

export interface WindowInitData {
  adoptSessionId: string
  savedConnectionId: string
}

type CreateWindowFn = (initData?: WindowInitData) => void

const windows = new Set<BrowserWindow>()
const pendingInitData = new Map<number, WindowInitData>()
let createWindowFn: CreateWindowFn | null = null

export const windowManager = {
  add: (win: BrowserWindow): void => {
    windows.add(win)
  },

  remove: (win: BrowserWindow): void => {
    windows.delete(win)
  },

  count: (): number => {
    return windows.size
  },

  setPendingInitData: (webContentsId: number, data: WindowInitData): void => {
    pendingInitData.set(webContentsId, data)
  },

  consumePendingInitData: (webContentsId: number): WindowInitData | null => {
    const data = pendingInitData.get(webContentsId) ?? null
    pendingInitData.delete(webContentsId)
    return data
  },

  cleanupForWindow: (webContentsId: number): void => {
    pendingInitData.delete(webContentsId)
  },

  registerCreateWindow: (fn: CreateWindowFn): void => {
    createWindowFn = fn
  },

  openNewWindow: (initData?: WindowInitData): void => {
    if (!createWindowFn) {
      throw new Error('createWindow not registered')
    }
    createWindowFn(initData)
  }
}
