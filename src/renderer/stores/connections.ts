import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { ConnectionStatus, DatabaseType } from '../types/connection'
import type { SavedConnection, ConnectionConfig, ConnectionState } from '../types/connection'
import type { Database, Table } from '../types/table'

export const useConnectionsStore = defineStore('connections', () => {
  // State
  const connections = ref<SavedConnection[]>([])
  const connectionStates = ref<Map<string, ConnectionState>>(new Map())
  const activeConnectionId = ref<string | null>(null)
  const databases = ref<Map<string, Database[]>>(new Map())
  const tables = ref<Map<string, Table[]>>(new Map())
  const folders = ref<string[]>([])
  const localFolders = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const sortedConnections = computed(() => {
    return [...connections.value].sort((a, b) => {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    })
  })

  const activeConnection = computed(() => {
    if (!activeConnectionId.value) return null
    return connections.value.find((c) => c.id === activeConnectionId.value) || null
  })

  const isConnected = computed(() => {
    if (!activeConnectionId.value) return false
    const state = connectionStates.value.get(activeConnectionId.value)
    return state?.status === ConnectionStatus.Connected
  })

  const activeDatabases = computed(() => {
    if (!activeConnectionId.value) return []
    return databases.value.get(activeConnectionId.value) || []
  })

  const activeTables = computed(() => {
    if (!activeConnectionId.value) return []
    return tables.value.get(activeConnectionId.value) || []
  })

  const connectedIds = computed(() => {
    const ids: string[] = []
    connectionStates.value.forEach((state, id) => {
      if (state.status === ConnectionStatus.Connected || state.status === ConnectionStatus.Reconnecting) ids.push(id)
    })
    return ids
  })

  const connectedConnections = computed(() => {
    return connections.value.filter(c => {
      const status = connectionStates.value.get(c.id)?.status
      return status === ConnectionStatus.Connected || status === ConnectionStatus.Reconnecting
    })
  })

  const hasActiveConnections = computed(() => connectedIds.value.length > 0)

  const allFolders = computed(() => {
    const set = new Set<string>([...folders.value, ...localFolders.value])
    return [...set].sort((a, b) => a.localeCompare(b))
  })

  const connectionsByFolder = computed(() => {
    const grouped: Record<string, SavedConnection[]> = {}
    const ungrouped: SavedConnection[] = []

    // Initialize with all known folders (including empty local ones)
    for (const f of allFolders.value) {
      grouped[f] = []
    }

    for (const conn of sortedConnections.value) {
      if (conn.folder) {
        if (!grouped[conn.folder]) {
          grouped[conn.folder] = []
        }
        grouped[conn.folder].push(conn)
      } else {
        ungrouped.push(conn)
      }
    }

    return { grouped, ungrouped }
  })

  // Actions
  async function loadConnections() {
    isLoading.value = true
    error.value = null
    try {
      connections.value = await window.api.connections.list()
      folders.value = await window.api.connections.getFolders()
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
    connectionStates.value.set(id, { id, status: ConnectionStatus.Connecting })
    try {
      await window.api.connections.connect(id)
      connectionStates.value.set(id, { id, status: ConnectionStatus.Connected })
      activeConnectionId.value = id

      // Load tables directly for non-Redis connections
      // Redis uses database browsing in the sidebar instead
      const connection = connections.value.find(c => c.id === id)
      if (connection && connection.type !== DatabaseType.Redis) {
        await loadTables(id, connection.database)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Connection failed'
      connectionStates.value.set(id, { id, status: ConnectionStatus.Error, error: errorMsg })
      throw e
    }
  }

  async function disconnect(id: string) {
    try {
      await window.api.connections.disconnect(id)
      connectionStates.value.set(id, { id, status: ConnectionStatus.Disconnected })
      databases.value.delete(id)
      tables.value.delete(id)
      if (activeConnectionId.value === id) {
        const remaining = connectedIds.value.filter(cid => cid !== id)
        activeConnectionId.value = remaining[0] || null
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

  let connectionStatusListenerActive = false

  function initConnectionStatusListener() {
    if (connectionStatusListenerActive) return
    connectionStatusListenerActive = true

    window.api.connectionStatus.onChange((event) => {
      const { connectionId, status, attempt, error: errorMsg } = event

      if (status === ConnectionStatus.Reconnecting) {
        connectionStates.value.set(connectionId, {
          id: connectionId,
          status: ConnectionStatus.Reconnecting,
          reconnectAttempt: attempt
        })
      } else if (status === ConnectionStatus.Connected) {
        connectionStates.value.set(connectionId, {
          id: connectionId,
          status: ConnectionStatus.Connected
        })
        // Reload tables after successful reconnect
        const connection = connections.value.find(c => c.id === connectionId)
        if (connection && connection.type !== DatabaseType.Redis) {
          loadTables(connectionId, connection.database)
        }
      } else if (status === ConnectionStatus.Error) {
        connectionStates.value.set(connectionId, {
          id: connectionId,
          status: ConnectionStatus.Error,
          error: errorMsg
        })
      }
    })
  }

  async function reconnect(id: string): Promise<boolean> {
    return window.api.connections.reconnect(id)
  }

  function getConnectionState(id: string): ConnectionState {
    return connectionStates.value.get(id) || { id, status: ConnectionStatus.Disconnected }
  }

  function setActiveConnection(id: string | null) {
    activeConnectionId.value = id
  }

  function createFolder(name: string) {
    localFolders.value.add(name)
  }

  async function updateConnectionFolder(id: string, folder: string | null) {
    await window.api.connections.updateFolder(id, folder)
    const conn = connections.value.find(c => c.id === id)
    if (conn) {
      conn.folder = folder
    }
    folders.value = await window.api.connections.getFolders()
  }

  async function renameFolder(oldName: string, newName: string) {
    await window.api.connections.renameFolder(oldName, newName)
    for (const conn of connections.value) {
      if (conn.folder === oldName) {
        conn.folder = newName
      }
    }
    if (localFolders.value.has(oldName)) {
      localFolders.value.delete(oldName)
      localFolders.value.add(newName)
    }
    folders.value = await window.api.connections.getFolders()
  }

  async function updatePositions(positions: { id: string; sortOrder: number; folder: string | null }[]) {
    await window.api.connections.updatePositions(positions)
    // Update local state
    for (const p of positions) {
      const conn = connections.value.find(c => c.id === p.id)
      if (conn) {
        conn.sortOrder = p.sortOrder
        conn.folder = p.folder
      }
    }
  }

  async function deleteFolder(folder: string) {
    await window.api.connections.deleteFolder(folder)
    for (const conn of connections.value) {
      if (conn.folder === folder) {
        conn.folder = null
      }
    }
    localFolders.value.delete(folder)
    folders.value = await window.api.connections.getFolders()
  }

  return {
    // State
    connections,
    connectionStates,
    activeConnectionId,
    databases,
    tables,
    folders,
    isLoading,
    error,
    // Getters
    sortedConnections,
    activeConnection,
    isConnected,
    activeDatabases,
    activeTables,
    connectedIds,
    connectedConnections,
    hasActiveConnections,
    connectionsByFolder,
    allFolders,
    // Actions
    loadConnections,
    saveConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    reconnect,
    initConnectionStatusListener,
    loadDatabases,
    loadTables,
    getConnectionState,
    setActiveConnection,
    createFolder,
    updateConnectionFolder,
    renameFolder,
    updatePositions,
    deleteFolder
  }
})
