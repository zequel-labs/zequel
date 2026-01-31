import { ref, computed } from 'vue'
import { useConnectionsStore } from '../stores/connections'
import { useTabsStore } from '../stores/tabs'
import type { ConnectionConfig, SavedConnection } from '../types/connection'

export const useConnection = () => {
  const connectionsStore = useConnectionsStore()
  const tabsStore = useTabsStore()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const connections = computed(() => connectionsStore.sortedConnections)
  const activeConnection = computed(() => connectionsStore.activeConnection)
  const isConnected = computed(() => connectionsStore.isConnected)

  const connect = async (connection: SavedConnection) => {
    isLoading.value = true
    error.value = null
    try {
      await connectionsStore.connect(connection.id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Connection failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const disconnect = async (connectionId: string) => {
    isLoading.value = true
    error.value = null
    try {
      await connectionsStore.disconnect(connectionId)
      tabsStore.closeTabsForConnection(connectionId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Disconnect failed'
    } finally {
      isLoading.value = false
    }
  }

  const saveConnection = async (config: ConnectionConfig) => {
    isLoading.value = true
    error.value = null
    try {
      return await connectionsStore.saveConnection(config)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Save failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const deleteConnection = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      await connectionsStore.deleteConnection(id)
      tabsStore.closeTabsForConnection(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Delete failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const testConnection = async (config: ConnectionConfig): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    try {
      return await connectionsStore.testConnection(config)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Test failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const getConnectionState = (id: string) => {
    return connectionsStore.getConnectionState(id)
  }

  return {
    connections,
    activeConnection,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    saveConnection,
    deleteConnection,
    testConnection,
    getConnectionState
  }
}
