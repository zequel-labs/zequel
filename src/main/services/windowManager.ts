import type { BrowserWindow } from 'electron'

export interface WindowInitData {
  adoptSessionId: string
  savedConnectionId: string
}

type CreateWindowFn = (initData?: WindowInitData) => void

const windows = new Set<BrowserWindow>()
const pendingInitData = new Map<number, WindowInitData>()
// Track which sessions belong to which window (sessionId → webContentsId)
const sessionOwnership = new Map<string, number>()
const sessionsInTransfer = new Set<string>()
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
    for (const [sessionId, ownerWcId] of sessionOwnership) {
      if (ownerWcId === webContentsId) {
        sessionOwnership.delete(sessionId)
        sessionsInTransfer.delete(sessionId)
      }
    }
  },

  registerCreateWindow: (fn: CreateWindowFn): void => {
    createWindowFn = fn
  },

  openNewWindow: (initData?: WindowInitData): void => {
    if (!createWindowFn) {
      throw new Error('createWindow not registered')
    }
    createWindowFn(initData)
  },

  // Session ownership tracking
  setSessionOwner: (sessionId: string, webContentsId: number): void => {
    sessionOwnership.set(sessionId, webContentsId)
  },

  removeSessionOwner: (sessionId: string): void => {
    sessionOwnership.delete(sessionId)
  },

  transferSession: (sessionId: string, newWebContentsId: number): void => {
    sessionOwnership.set(sessionId, newWebContentsId)
  },

  getSessionsForWindow: (webContentsId: number): string[] => {
    const result: string[] = []
    for (const [sessionId, ownerWcId] of sessionOwnership) {
      if (ownerWcId === webContentsId) {
        result.push(sessionId)
      }
    }
    return result
  },

  markSessionInTransfer: (sessionId: string): void => {
    sessionsInTransfer.add(sessionId)
  },

  clearSessionTransfer: (sessionId: string): void => {
    sessionsInTransfer.delete(sessionId)
  },

  isSessionInTransfer: (sessionId: string): boolean => {
    return sessionsInTransfer.has(sessionId)
  }
}
