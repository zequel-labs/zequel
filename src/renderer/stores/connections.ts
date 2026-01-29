import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { SavedConnection, ConnectionConfig, ConnectionState, DatabaseType } from '../types/connection'
import type { Database, Table } from '../types/table'

export const useConnectionsStore = defineStore('connections', () => {
  // State
  const connections = ref<SavedConnection[]>([])
  const connectionStates = ref<Map<string, ConnectionState>>(new Map())
  const activeConnectionId = ref<string | null>(null)
  const databases = ref<Map<string, Database[]>>(new Map())
  const tables = ref<Map<string, Table[]>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const sortedConnections = computed(() => {
    return [...connections.value].sort((a, b) => {
      // Sort by last connected, then by name
      if (a.lastConnectedAt && b.lastConnectedAt) {
        return new Date(b.lastConnectedAt).getTime() - new Date(a.lastConnectedAt).getTime()
      }
      if (a.lastConnectedAt) return -1
      if (b.lastConnectedAt) return 1
      return a.name.localeCompare(b.name)
    })
  })

  const activeConnection = computed(() => {
    if (!activeConnectionId.value) return null
    return connections.value.find((c) => c.id === activeConnectionId.value) || null
  })

  const isConnected = computed(() => {
    if (!activeConnectionId.value) return false
    const state = connectionStates.value.get(activeConnectionId.value)
    return state?.status === 'connected'
  })

  const activeDatabases = computed(() => {
    if (!activeConnectionId.value) return []
    return databases.value.get(activeConnectionId.value) || []
  })

  const activeTables = computed(() => {
    if (!activeConnectionId.value) return []
    return tables.value.get(activeConnectionId.value) || []
  })

  // Actions
  async function loadConnections() {
    isLoading.value = true
    error.value = null
    try {
      connections.value = await window.api.connections.list()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load connections'
    } finally {
      isLoading.value = false
    }
  }

  async function saveConnection(config: ConnectionConfig) {
    isLoading.value = true
    error.value = null
    try {
      const plainConfig = JSON.parse(JSON.stringify(toRaw(config)))
      const saved = await window.api.connections.save(plainConfig)
      const index = connections.value.findIndex((c) => c.id === saved.id)
      if (index >= 0) {
        connections.value[index] = saved
      } else {
        connections.value.push(saved)
      }
      return saved
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save connection'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteConnection(id: string) {
    isLoading.value = true
    error.value = null
    try {
      await window.api.connections.delete(id)
      const index = connections.value.findIndex((c) => c.id === id)
      if (index >= 0) {
        connections.value.splice(index, 1)
      }
      connectionStates.value.delete(id)
      databases.value.delete(id)
      tables.value.delete(id)
      if (activeConnectionId.value === id) {
        activeConnectionId.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete connection'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const plainConfig = JSON.parse(JSON.stringify(toRaw(config)))
      const result = await window.api.connections.test(plainConfig)
      return result.success
    } catch {
      return false
    }
  }

  async function connect(id: string) {
    connectionStates.value.set(id, { id, status: 'connecting' })
    try {
      await window.api.connections.connect(id)
      connectionStates.value.set(id, { id, status: 'connected' })
      activeConnectionId.value = id

      // Get the connection config and load tables directly
      const connection = connections.value.find(c => c.id === id)
      if (connection) {
        // Load tables directly for the configured database
        await loadTables(id, connection.database)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Connection failed'
      connectionStates.value.set(id, { id, status: 'error', error: errorMsg })
      throw e
    }
  }

  async function disconnect(id: string) {
    try {
      await window.api.connections.disconnect(id)
      connectionStates.value.set(id, { id, status: 'disconnected' })
      databases.value.delete(id)
      tables.value.delete(id)
      if (activeConnectionId.value === id) {
        activeConnectionId.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to disconnect'
    }
  }

  async function loadDatabases(connectionId: string) {
    try {
      const dbs = await window.api.schema.databases(connectionId)
      databases.value.set(connectionId, dbs)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load databases'
    }
  }

  async function loadTables(connectionId: string, database: string, schema?: string) {
    try {
      const tbls = await window.api.schema.tables(connectionId, database, schema)
      tables.value.set(connectionId, tbls)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tables'
    }
  }

  function getConnectionState(id: string): ConnectionState {
    return connectionStates.value.get(id) || { id, status: 'disconnected' }
  }

  function setActiveConnection(id: string | null) {
    activeConnectionId.value = id
  }

  return {
    // State
    connections,
    connectionStates,
    activeConnectionId,
    databases,
    tables,
    isLoading,
    error,
    // Getters
    sortedConnections,
    activeConnection,
    isConnected,
    activeDatabases,
    activeTables,
    // Actions
    loadConnections,
    saveConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    loadDatabases,
    loadTables,
    getConnectionState,
    setActiveConnection
  }
})
