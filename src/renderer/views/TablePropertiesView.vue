<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { formatNumber } from '@/lib/utils'
import { useTabsStore, type TablePropertiesTabData } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { useColumnResize } from '@/composables/useColumnResize'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import type { TableProperties } from '@/types/table'
import { TableObjectType } from '@/types/table'

interface PropertyRow {
  label: string
  value: string
}

interface PropertySection {
  title: string
  rows: PropertyRow[]
}

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const properties = ref<TableProperties | null>(null)

const { columnWidths, resizingColumn, onResizeStart } = useColumnResize({
  property: 200,
  value: 400,
})

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as TablePropertiesTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const tableName = computed(() => tabData.value?.tableName || '')
const tableType = computed(() => tabData.value?.tableType || TableObjectType.Table)
const schemaName = computed(() => tabData.value?.schema)

const formatBoolean = (val: boolean): string => val ? 'Yes' : 'No'

const sections = computed((): PropertySection[] => {
  const p = properties.value
  if (!p) return []

  const result: PropertySection[] = []

  // General
  const general: PropertyRow[] = []
  if (p.name) general.push({ label: 'Name', value: p.name })
  if (p.type) general.push({ label: 'Type', value: p.type })
  if (p.schema) general.push({ label: 'Schema', value: p.schema })
  if (p.database) general.push({ label: 'Database', value: p.database })
  if (p.owner) general.push({ label: 'Owner', value: p.owner })
  if (p.comment) general.push({ label: 'Comment', value: p.comment })
  if (general.length > 0) result.push({ title: 'General', rows: general })

  // Storage
  const storage: PropertyRow[] = []
  if (p.engine) storage.push({ label: 'Engine', value: p.engine })
  if (p.rowFormat) storage.push({ label: 'Row Format', value: p.rowFormat })
  if (p.collation) storage.push({ label: 'Collation', value: p.collation })
  if (p.charset) storage.push({ label: 'Charset', value: p.charset })
  if (p.tablespace) storage.push({ label: 'Tablespace', value: p.tablespace })
  if (p.pageCount !== undefined) storage.push({ label: 'Page Count', value: formatNumber(p.pageCount) })
  if (p.pageSize !== undefined) storage.push({ label: 'Page Size', value: `${formatNumber(p.pageSize)} B` })
  if (storage.length > 0) result.push({ title: 'Storage', rows: storage })

  // Statistics
  const stats: PropertyRow[] = []
  if (p.rowCount !== undefined) stats.push({ label: 'Row Count', value: formatNumber(p.rowCount) })
  if (p.totalSize) stats.push({ label: 'Total Size', value: p.totalSize })
  if (p.tableSize) stats.push({ label: 'Table Size', value: p.tableSize })
  if (p.indexSize) stats.push({ label: 'Index Size', value: p.indexSize })
  if (p.dataLength) stats.push({ label: 'Data Length', value: p.dataLength })
  if (p.indexLength) stats.push({ label: 'Index Length', value: p.indexLength })
  if (p.dataFree) stats.push({ label: 'Data Free', value: p.dataFree })
  if (p.avgRowLength !== undefined) stats.push({ label: 'Avg Row Length', value: formatNumber(p.avgRowLength) })
  if (p.autoIncrement !== undefined) stats.push({ label: 'Auto Increment', value: formatNumber(p.autoIncrement) })
  if (p.columnCount !== undefined) stats.push({ label: 'Column Count', value: String(p.columnCount) })
  if (p.indexCount !== undefined) stats.push({ label: 'Index Count', value: String(p.indexCount) })
  if (p.oid !== undefined) stats.push({ label: 'OID', value: String(p.oid) })
  if (p.hasIndexes !== undefined) stats.push({ label: 'Has Indexes', value: formatBoolean(p.hasIndexes) })
  if (p.hasRules !== undefined) stats.push({ label: 'Has Rules', value: formatBoolean(p.hasRules) })
  if (p.hasTriggers !== undefined) stats.push({ label: 'Has Triggers', value: formatBoolean(p.hasTriggers) })
  if (p.totalRows !== undefined) stats.push({ label: 'Total Rows', value: formatNumber(p.totalRows) })
  if (p.totalBytes) stats.push({ label: 'Total Bytes', value: p.totalBytes })
  if (p.storageSize) stats.push({ label: 'Storage Size', value: p.storageSize })
  if (p.avgObjSize) stats.push({ label: 'Avg Object Size', value: p.avgObjSize })
  if (p.nindexes !== undefined) stats.push({ label: 'Indexes', value: String(p.nindexes) })
  if (p.totalIndexSize) stats.push({ label: 'Total Index Size', value: p.totalIndexSize })
  if (p.capped !== undefined) stats.push({ label: 'Capped', value: formatBoolean(p.capped) })
  if (p.createTime) stats.push({ label: 'Created', value: p.createTime })
  if (p.updateTime) stats.push({ label: 'Updated', value: p.updateTime })
  if (p.metadataModificationTime) stats.push({ label: 'Metadata Modified', value: p.metadataModificationTime })
  if (stats.length > 0) result.push({ title: 'Statistics', rows: stats })

  // Keys & Partitioning
  const keys: PropertyRow[] = []
  if (p.partitionKey) keys.push({ label: 'Partition Key', value: p.partitionKey })
  if (p.sortingKey) keys.push({ label: 'Sorting Key', value: p.sortingKey })
  if (p.primaryKey) keys.push({ label: 'Primary Key', value: p.primaryKey })
  if (p.samplingKey) keys.push({ label: 'Sampling Key', value: p.samplingKey })
  if (keys.length > 0) result.push({ title: 'Keys & Partitioning', rows: keys })

  return result
})

const totalPropertyCount = computed(() => {
  return sections.value.reduce((sum, section) => sum + section.rows.length, 0)
})

const hasDdl = computed(() => !!properties.value?.ddl)

const loadProperties = async () => {
  if (!connectionId.value || !tableName.value) return

  loading.value = true
  error.value = null

  try {
    const result = await window.api.schema.getTableProperties(
      connectionId.value,
      tableName.value,
      tableType.value,
      schemaName.value
    )
    properties.value = result
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load properties'
  } finally {
    loading.value = false
  }
}

const copyDdl = async () => {
  if (!properties.value?.ddl) return
  try {
    await navigator.clipboard.writeText(properties.value.ddl)
    toast.success('DDL copied to clipboard')
  } catch {
    // Ignore
  }
}

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showTablePropertiesControls = true
  statusBarStore.tablePropertiesCount = totalPropertyCount.value
  statusBarStore.tablePropertiesHasDdl = hasDdl.value
  statusBarStore.registerTablePropertiesCallbacks({
    onRefresh: () => loadProperties(),
    onCopyDdl: () => copyDdl(),
  })
}

onMounted(() => {
  setupStatusBar()
  loadProperties()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch(totalPropertyCount, (count) => {
  if (tabsStore.activeTabId === props.tabId) {
    statusBarStore.tablePropertiesCount = count
  }
})

watch(hasDdl, (val) => {
  if (tabsStore.activeTabId === props.tabId) {
    statusBarStore.tablePropertiesHasDdl = val
  }
})

watch([tableName, schemaName], () => {
  loadProperties()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle class="h-8 w-8 text-destructive" />
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="loadProperties">
        Retry
      </Button>
    </div>

    <!-- Properties Content -->
    <template v-else-if="properties">
      <ScrollArea class="flex-1">
        <table class="w-full border-collapse text-xs" :class="{ 'select-none': resizingColumn }" style="table-layout: fixed;">
          <colgroup>
            <col :style="{ width: `${columnWidths.property}px` }" />
            <col :style="{ width: `${columnWidths.value}px` }" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-background">
            <tr>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Property
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'property' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('property', $event)" />
              </th>
              <th class="px-2 py-1.5 text-left font-medium border-b border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="section in sections" :key="section.title">
              <!-- Section header row -->
              <tr>
                <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
                  {{ section.title }}
                </td>
              </tr>
              <!-- Property rows -->
              <tr v-for="row in section.rows" :key="`${section.title}-${row.label}`" class="h-8 hover:bg-muted/30">
                <td class="p-0 border-b border-r border-border">
                  <div class="h-8 px-2 flex items-center text-muted-foreground truncate">{{ row.label }}</div>
                </td>
                <td class="p-0 border-b border-border">
                  <div class="h-8 px-2 flex items-center font-mono truncate">{{ row.value }}</div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- DDL Section -->
        <div v-if="hasDdl">
          <div class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-xs">
            DDL
          </div>
          <pre class="bg-muted p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap">{{ properties.ddl }}</pre>
        </div>
      </ScrollArea>
    </template>
  </div>
</template>
