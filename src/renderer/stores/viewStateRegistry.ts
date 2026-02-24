import type { ViewState } from '@/types/viewState'

type CollectStateFn = () => ViewState | null

const collectors = new Map<string, CollectStateFn>()

export const viewStateRegistry = {
  register: (tabId: string, collector: CollectStateFn): void => {
    collectors.set(tabId, collector)
  },
  unregister: (tabId: string): void => {
    collectors.delete(tabId)
  },
  collectForSession: (tabIds: string[]): Map<string, ViewState> => {
    const result = new Map<string, ViewState>()
    for (const tabId of tabIds) {
      const fn = collectors.get(tabId)
      if (fn) {
        try {
          const state = fn()
          if (state) result.set(tabId, state)
        } catch {
          // Skip tabs whose collector fails (e.g. unmounted DataGrid)
        }
      }
    }
    return result
  },
  /** Visible for testing only */
  _collectors: collectors
}
