<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type EnumsTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconLoader2, IconAlertTriangle } from '@tabler/icons-vue'
import type { EnumType } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const enums = ref<EnumType[]>([])

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as EnumsTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const schemaName = computed(() => tabData.value?.schema)

const filteredEnums = computed(() => {
  if (!schemaName.value) return enums.value
  return enums.value.filter((e) => e.schema === schemaName.value)
})

const loadEnums = async () => {
  if (!connectionId.value) return

  loading.value = true
  error.value = null

  try {
    enums.value = await window.api.schema.getEnums(connectionId.value, schemaName.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load enums'
    console.error('Error loading enums:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadEnums()
})

watch(connectionId, () => {
  loadEnums()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
      <IconAlertTriangle class="h-8 w-8 text-destructive" />
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="loadEnums">
        Retry
      </Button>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredEnums.length === 0" class="flex items-center justify-center h-full">
      <p class="text-sm text-muted-foreground">No enum types found</p>
    </div>

    <!-- Content -->
    <ScrollArea v-else class="flex-1">
      <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col style="width: 200px;" />
          <col />
        </colgroup>
        <tbody>
          <template v-for="(enumType, index) in filteredEnums" :key="enumType.name">
            <tr>
              <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider"
                :class="{ 'border-t': index > 0 }">
                {{ enumType.name }}
                <span class="normal-case tracking-normal font-normal ml-1">({{ enumType.values.length }} values)</span>
              </td>
            </tr>
            <tr class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">Schema</div>
              </td>
              <td class="p-0 border-b border-border">
                <div :class="['h-8 px-2 flex items-center font-mono', connectionsStore.privacyMode ? 'blur-sm select-none' : '']">{{ enumType.schema }}</div>
              </td>
            </tr>
            <tr class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">Values</div>
              </td>
              <td class="p-0 border-b border-border">
                <div :class="['min-h-[2rem] px-2 py-1 flex items-center gap-1 flex-wrap', connectionsStore.privacyMode ? 'blur-sm select-none' : '']">
                  <span
                    v-for="value in enumType.values"
                    :key="value"
                    class="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono"
                  >{{ value }}</span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </ScrollArea>
  </div>
</template>
