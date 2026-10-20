<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { TabType } from '@/types/table'
const props = defineProps<{ tabId: string; mode: 'backup' | 'restore' }>()
const tabs = useTabsStore()
const connections = useConnectionsStore()
const error = ref('')
const data = computed(() => tabs.tabs.find(tab => tab.id === props.tabId)?.data)
const open = async (): Promise<void> => {
  const tab = data.value
  if (!tab || (tab.type !== TabType.Backup && tab.type !== TabType.Restore)) return
  try {
    await window.api.transfers.open(props.mode, connections.getSavedConnectionId(tab.connectionId) || tab.connectionId, tab.database)
    tabs.closeTab(props.tabId)
  } catch (cause) { error.value = String(cause) }
}
</script>
<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <h2 class="text-lg font-medium">{{ mode === 'backup' ? 'Backup' : 'Restore' }} has its own window</h2>
    <p class="max-w-md text-sm text-muted-foreground">Continue with a dedicated connection. You can review the database and file before starting.</p>
    <Button @click="open">Open {{ mode }}</Button>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
