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

  const init = () => {
    if (listenerActive) return
    if (!window.api?.queryLog) return
    listenerActive = true
    window.api.queryLog.onEntry((entry) => {
      entries.value.push(entry)
    })
  }

  const clear = () => {
    entries.value = []
  }

  const clearForConnection = (connectionId: string) => {
    entries.value = entries.value.filter(e => e.connectionId !== connectionId)
  }

  const destroy = () => {
    window.api.queryLog.removeListener()
    listenerActive = false
    entries.value = []
  }

  return { entries, init, clear, clearForConnection, destroy }
})
