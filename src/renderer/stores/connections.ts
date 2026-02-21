import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { ConnectionStatus } from '@/types/connection'
import type { SavedConnection, ConnectionConfig, ConnectionState } from '@/types/connection'
import type { Database, Table, DatabaseSchema } from '@/types/table'

export const useConnectionsStore = defineStore('connections', () => {
  // State
  const connections = ref<SavedConnection[]>([])
  const connectionStates = ref<Map<string, ConnectionState>>(new Map())
  const activeSessionId = ref<string | null>(null)
  // Maps sessionId → { savedConnectionId }
  const sessions = ref<Map<string, { savedConnectionId: string }>>(new Map())
  const databases = ref<Map<string, Database[]>>(new Map())
  const tables = ref<Map<string, Table[]>>(new Map())
  const folders = ref<string[]>([])
  const localFolders = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  // In-memory only: tracks per-session working database when user switches databases at runtime
  const activeDatabaseOverrides = ref<Map<string, string>>(new Map())
  // In-memory only: tracks per-session active schema (PostgreSQL only)
  const activeSchemaOverrides = ref<Map<string, string>>(new Map())
  const schemas = ref<Map<string, DatabaseSchema[]>>(new Map())
  const serverVersions = ref<Map<string, string>>(new Map())
  // In-memory only: tracks per-session safe mode (read-only protection)
  const safeModeOverrides = ref<Map<string, boolean>>(new Map())
  // In-memory only: tracks per-session privacy mode (data masking)
  const privacyModeOverrides = ref<Map<string, boolean>>(new Map())

  // Getters
  const sortedConnections = computed(() => {
    return [...connections.value].sort((a, b) => {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    })
  })

  const activeConnection = computed(() => {
    if (!activeSessionId.value) return null
    return getConnectionForSession(activeSessionId.value)
  })

  const isConnected = computed(() => {
    if (!activeSessionId.value) return false
    const state = connectionStates.value.get(activeSessionId.value)
    return state?.status === ConnectionStatus.Connected
  })

  const activeDatabases = computed(() => {
    if (!activeSessionId.value) return []
    return databases.value.get(activeSessionId.value) || []
  })

  const activeTables = computed(() => {
    if (!activeSessionId.value) return []
    return tables.value.get(activeSessionId.value) || []
  })

  const connectedIds = computed(() => {
    const ids: string[] = []
    connectionStates.value.forEach((state, id) => {
      if (state.status === ConnectionStatus.Connected || state.status === ConnectionStatus.Reconnecting) ids.push(id)
    })
    return ids
  })

  const connectedConnections = computed(() => {
    const result: SavedConnection[] = []
    for (const [sessionId] of sessions.value) {
      const status = connectionStates.value.get(sessionId)?.status
      if (status === ConnectionStatus.Connected || status === ConnectionStatus.Reconnecting) {
        const conn = getConnectionForSession(sessionId)
        if (conn) result.push(conn)
      }
    }
    return result
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
  const loadConnections = async () => {
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

  const saveConnection = async (config: ConnectionConfig) => {
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

  const deleteConnection = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      // Clean up all sessions for this saved connection (renderer-side)
      const sessionsToRemove = getSessionsForSavedConnection(id)

      // Close tabs for all sessions being removed
      const { useTabsStore } = await import('@/stores/tabs')
      const tabsStore = useTabsStore()
      for (const sessionId of sessionsToRemove) {
        tabsStore.closeTabsForConnection(sessionId)
        connectionStates.value.delete(sessionId)
        sessions.value.delete(sessionId)
        databases.value.delete(sessionId)
        tables.value.delete(sessionId)
        serverVersions.value.delete(sessionId)
        activeDatabaseOverrides.value.delete(sessionId)
        activeSchemaOverrides.value.delete(sessionId)
        schemas.value.delete(sessionId)
        safeModeOverrides.value.delete(sessionId)
        privacyModeOverrides.value.delete(sessionId)
      }

      // IPC handler disconnects all sessions on the backend
      await window.api.connections.delete(id)
      const index = connections.value.findIndex((c) => c.id === id)
      if (index >= 0) {
        connections.value.splice(index, 1)
      }

      if (activeSessionId.value && sessionsToRemove.includes(activeSessionId.value)) {
        const remaining = connectedIds.value
        activeSessionId.value = remaining[0] || null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete connection'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const testConnection = async (config: ConnectionConfig): Promise<boolean> => {
    try {
      const plainConfig = JSON.parse(JSON.stringify(toRaw(config)))
      const result = await window.api.connections.test(plainConfig)
      return result.success
    } catch {
      return false
    }
  }

  const fetchServerVersion = async (id: string) => {
    try {
      const version = await window.api.connections.getServerVersion(id)
      if (version) {
        serverVersions.value.set(id, version)
      }
    } catch {
      // Non-critical, ignore errors
    }
  }

  const connect = async (savedId: string) => {
    // Clean up stale error/connecting entries from previous failed attempts
    for (const [key, state] of connectionStates.value) {
      if (key.startsWith('connecting-') && (state.status === ConnectionStatus.Error || state.status === ConnectionStatus.Connecting)) {
        connectionStates.value.delete(key)
      }
    }

    // Use a temporary key for the connecting state until we get the sessionId
    const tempKey = `connecting-${savedId}-${Date.now()}`
    connectionStates.value.set(tempKey, { id: tempKey, status: ConnectionStatus.Connecting })
    try {
      const sessionId = await window.api.connections.connect(savedId)
      // Remove temporary state and set real session state
      connectionStates.value.delete(tempKey)
      sessions.value.set(sessionId, { savedConnectionId: savedId })
      connectionStates.value.set(sessionId, { id: sessionId, status: ConnectionStatus.Connected })
      activeSessionId.value = sessionId

      // Fetch server version (non-blocking)
      fetchServerVersion(sessionId)

      const connection = connections.value.find(c => c.id === savedId)
      if (connection) {
        if (connection.database) {
          await loadTables(sessionId, connection.database)
        } else {
          await loadDatabases(sessionId)
        }
      }
    } catch (e) {
      connectionStates.value.delete(tempKey)
      const errorMsg = e instanceof Error ? e.message : 'Connection failed'
      connectionStates.value.set(tempKey, { id: tempKey, status: ConnectionStatus.Error, error: errorMsg })
      throw e
    }
  }

  const connectWithConfig = async (config: ConnectionConfig) => {
    // Clean up stale error/connecting entries from previous failed attempts
    for (const [key, state] of connectionStates.value) {
      if (key.startsWith('connecting-') && (state.status === ConnectionStatus.Error || state.status === ConnectionStatus.Connecting)) {
        connectionStates.value.delete(key)
      }
    }

    const savedId = config.id || 'unsaved'
    const tempKey = `connecting-${savedId}-${Date.now()}`
    connectionStates.value.set(tempKey, { id: tempKey, status: ConnectionStatus.Connecting })
    try {
      const plainConfig = JSON.parse(JSON.stringify(toRaw(config)))
      const sessionId = await window.api.connections.connectWithConfig(plainConfig)
      connectionStates.value.delete(tempKey)
      sessions.value.set(sessionId, { savedConnectionId: savedId })
      connectionStates.value.set(sessionId, { id: sessionId, status: ConnectionStatus.Connected })
      activeSessionId.value = sessionId

      // Add ephemeral entry to connections so activeConnection and UI work
      if (!connections.value.find(c => c.id === savedId)) {
        const now = new Date().toISOString()
        connections.value.push({
          id: savedId,
          name: config.name,
          type: config.type,
          host: config.host ?? null,
          port: config.port ?? null,
          database: config.database,
          username: config.username ?? null,
          filepath: config.filepath ?? null,
          ssl: config.ssl ?? false,
          sslConfig: config.sslConfig ?? null,
          ssh: config.ssh ?? null,
          color: config.color ?? null,
          environment: config.environment ?? null,
          folder: config.folder ?? null,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
          lastConnectedAt: now
        })
      }

      // Fetch server version (non-blocking)
      fetchServerVersion(sessionId)

      if (config.database) {
        await loadTables(sessionId, config.database)
      } else {
        await loadDatabases(sessionId)
      }
    } catch (e) {
      connectionStates.value.delete(tempKey)
      const errorMsg = e instanceof Error ? e.message : 'Connection failed'
      connectionStates.value.set(tempKey, { id: tempKey, status: ConnectionStatus.Error, error: errorMsg })
      throw e
    }
  }

  const disconnect = async (sessionId: string) => {
    try {
      await window.api.connections.disconnect(sessionId)
      connectionStates.value.delete(sessionId)
      sessions.value.delete(sessionId)
      cleanupSessionData(sessionId)
      if (activeSessionId.value === sessionId) {
        const remaining = connectedIds.value.filter(cid => cid !== sessionId)
        activeSessionId.value = remaining[0] || null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to disconnect'
    }
  }

  const disconnectOthers = async (keepSessionId: string) => {
    const others = connectedIds.value.filter(id => id !== keepSessionId)
    for (const id of others) {
      await disconnect(id)
    }
  }

  const loadDatabases = async (connectionId: string) => {
    try {
      const dbs = await window.api.schema.databases(connectionId)
      databases.value.set(connectionId, dbs)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load databases'
    }
  }

  const loadTables = async (connectionId: string, database: string, schema?: string) => {
    try {
      const tbls = await window.api.schema.tables(connectionId, database, schema)
      tables.value.set(connectionId, tbls)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tables'
    }
  }

  const loadSchemas = async (connectionId: string) => {
    try {
      const result = await window.api.schema.getSchemas(connectionId)
      schemas.value.set(connectionId, result)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load schemas'
    }
  }

  const setActiveSchema = async (connectionId: string, schema: string) => {
    try {
      await window.api.schema.setCurrentSchema(connectionId, schema)
      activeSchemaOverrides.value.set(connectionId, schema)
      const db = getActiveDatabase(connectionId)
      await loadTables(connectionId, db, schema)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to set active schema'
    }
  }

  const getActiveSchema = (connectionId: string): string => {
    return activeSchemaOverrides.value.get(connectionId) || 'public'
  }

  const safeMode = computed(() => {
    if (!activeSessionId.value) return false
    return safeModeOverrides.value.get(activeSessionId.value) ?? false
  })

  const privacyMode = computed(() => {
    if (!activeSessionId.value) return false
    return privacyModeOverrides.value.get(activeSessionId.value) ?? false
  })

  const toggleSafeMode = () => {
    if (!activeSessionId.value) return
    const current = safeModeOverrides.value.get(activeSessionId.value) ?? false
    safeModeOverrides.value.set(activeSessionId.value, !current)
  }

  const togglePrivacyMode = () => {
    if (!activeSessionId.value) return
    const current = privacyModeOverrides.value.get(activeSessionId.value) ?? false
    privacyModeOverrides.value.set(activeSessionId.value, !current)
  }

  const isSafeModeForSession = (sessionId: string): boolean => {
    return safeModeOverrides.value.get(sessionId) ?? false
  }

  let connectionStatusListenerActive = false

  const initConnectionStatusListener = () => {
    if (connectionStatusListenerActive) return
    connectionStatusListenerActive = true

    window.api.connectionStatus.onChange((event) => {
      const { connectionId, status, attempt, error: errorMsg } = event

      // Ignore events for sessions not owned by this window
      if (!sessions.value.has(connectionId)) return

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
        // Reload tables after successful reconnect, using database and schema overrides if set
        const db = getActiveDatabase(connectionId)
        if (db) {
          const schema = activeSchemaOverrides.value.get(connectionId)
          loadTables(connectionId, db, schema)
        } else {
          loadDatabases(connectionId)
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

  const reconnect = async (id: string): Promise<boolean> => {
    return window.api.connections.reconnect(id)
  }

  const getConnectionState = (id: string): ConnectionState => {
    return connectionStates.value.get(id) || { id, status: ConnectionStatus.Disconnected }
  }

  const setActiveDatabase = (connectionId: string, database: string): void => {
    activeDatabaseOverrides.value.set(connectionId, database)
  }

  const getActiveDatabase = (sessionId: string): string => {
    const override = activeDatabaseOverrides.value.get(sessionId)
    if (override) return override
    const connection = getConnectionForSession(sessionId)
    return connection?.database || ''
  }

  const setActiveConnection = (id: string | null) => {
    activeSessionId.value = id
  }

  const getSavedConnectionId = (sessionId: string): string | null => {
    return sessions.value.get(sessionId)?.savedConnectionId ?? null
  }

  const getConnectionForSession = (sessionId: string): SavedConnection | null => {
    const savedId = getSavedConnectionId(sessionId)
    if (!savedId) return null
    return connections.value.find(c => c.id === savedId) || null
  }

  const getSessionsForSavedConnection = (savedConnectionId: string): string[] => {
    const result: string[] = []
    for (const [sessionId, session] of sessions.value) {
      if (session.savedConnectionId === savedConnectionId) result.push(sessionId)
    }
    return result
  }

  /**
   * Clean up all session-keyed data Maps for a given session ID.
   * Used during disconnect, delete, and database switching.
   */
  const cleanupSessionData = (sessionId: string) => {
    databases.value.delete(sessionId)
    tables.value.delete(sessionId)
    serverVersions.value.delete(sessionId)
    activeDatabaseOverrides.value.delete(sessionId)
    activeSchemaOverrides.value.delete(sessionId)
    schemas.value.delete(sessionId)
    safeModeOverrides.value.delete(sessionId)
    privacyModeOverrides.value.delete(sessionId)
  }

  /**
   * Migrate session state from an old session ID to a new one.
   * Used when database switching creates a new session (PostgreSQL, ClickHouse).
   */
  const migrateSession = (oldSessionId: string, newSessionId: string) => {
    const savedId = getSavedConnectionId(oldSessionId)
    if (savedId) {
      sessions.value.set(newSessionId, { savedConnectionId: savedId })
    }

    // Preserve overrides for the new session before cleanup deletes them
    const databaseOverride = activeDatabaseOverrides.value.get(oldSessionId)
    const schemaOverride = activeSchemaOverrides.value.get(oldSessionId)
    const safeModeOverride = safeModeOverrides.value.get(oldSessionId)
    const privacyModeOverride = privacyModeOverrides.value.get(oldSessionId)

    sessions.value.delete(oldSessionId)
    connectionStates.value.delete(oldSessionId)
    cleanupSessionData(oldSessionId)
    connectionStates.value.set(newSessionId, { id: newSessionId, status: ConnectionStatus.Connected })

    // Atomically update activeSessionId if it was pointing to the old session
    if (activeSessionId.value === oldSessionId) {
      activeSessionId.value = newSessionId
    }

    if (databaseOverride) {
      activeDatabaseOverrides.value.set(newSessionId, databaseOverride)
    }
    if (schemaOverride) {
      activeSchemaOverrides.value.set(newSessionId, schemaOverride)
    }
    if (safeModeOverride !== undefined) {
      safeModeOverrides.value.set(newSessionId, safeModeOverride)
    }
    if (privacyModeOverride !== undefined) {
      privacyModeOverrides.value.set(newSessionId, privacyModeOverride)
    }
  }

  const removeLocalSession = (sessionId: string): void => {
    connectionStates.value.delete(sessionId)
    sessions.value.delete(sessionId)
    cleanupSessionData(sessionId)
    if (activeSessionId.value === sessionId) {
      const remaining = connectedIds.value.filter(cid => cid !== sessionId)
      activeSessionId.value = remaining[0] || null
    }
  }

  const adoptSession = async (sessionId: string, savedConnectionId: string): Promise<void> => {
    sessions.value.set(sessionId, { savedConnectionId })
    connectionStates.value.set(sessionId, { id: sessionId, status: ConnectionStatus.Connected })
    activeSessionId.value = sessionId

    fetchServerVersion(sessionId)

    const conn = connections.value.find(c => c.id === savedConnectionId)
    if (conn) {
      const db = conn.database || ''
      // PostgreSQL and SQL Server need schemas loaded for sidebar trees
      if (conn.type === 'postgresql' || conn.type === 'sqlserver') {
        await loadSchemas(sessionId)
        const schema = getActiveSchema(sessionId)
        await loadTables(sessionId, db, schema)
      } else if (db) {
        await loadTables(sessionId, db)
      } else {
        await loadDatabases(sessionId)
      }
    }
  }

  const createFolder = (name: string) => {
    localFolders.value.add(name)
  }

  const updateConnectionFolder = async (id: string, folder: string | null) => {
    await window.api.connections.updateFolder(id, folder)
    const conn = connections.value.find(c => c.id === id)
    if (conn) {
      conn.folder = folder
    }
    folders.value = await window.api.connections.getFolders()
  }

  const renameFolder = async (oldName: string, newName: string) => {
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

  const updatePositions = async (positions: { id: string; sortOrder: number; folder: string | null }[]) => {
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

  const deleteFolder = async (folder: string) => {
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
    activeSessionId,
    sessions,
    databases,
    tables,
    schemas,
    serverVersions,
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
    connectWithConfig,
    disconnect,
    disconnectOthers,
    reconnect,
    initConnectionStatusListener,
    loadDatabases,
    loadTables,
    loadSchemas,
    setActiveSchema,
    getActiveSchema,
    getConnectionState,
    setActiveDatabase,
    getActiveDatabase,
    setActiveConnection,
    getSavedConnectionId,
    getConnectionForSession,
    getSessionsForSavedConnection,
    safeMode,
    privacyMode,
    toggleSafeMode,
    togglePrivacyMode,
    isSafeModeForSession,
    cleanupSessionData,
    migrateSession,
    removeLocalSession,
    adoptSession,
    createFolder,
    updateConnectionFolder,
    renameFolder,
    updatePositions,
    deleteFolder
  }
})
