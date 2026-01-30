import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface QueryLogEntry {
  connectionId: string
  sql: string
  timestamp: string
  executionTime?: number
}

export const useQueryLogStore = defineStore('queryLog', () => {
  const entries = ref<QueryLogEntry[]>([])
  let listenerActive = false

  function init() {
    if (listenerActive) return
    if (!window.api?.queryLog) return
    listenerActive = true
    window.api.queryLog.onEntry((entry) => {
      entries.value.push(entry)
    })
  }

  function clear() {
    entries.value = []
  }

  function clearForConnection(connectionId: string) {
    entries.value = entries.value.filter(e => e.connectionId !== connectionId)
  }

  function destroy() {
    window.api.queryLog.removeListener()
    listenerActive = false
    entries.value = []
  }

  return { entries, init, clear, clearForConnection, destroy }
})
