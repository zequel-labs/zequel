<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useTabsStore, type TablePropertiesTabData } from '@/stores/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Table2, Eye, Copy, Check } from 'lucide-vue-next'
import type { TableProperties } from '@/types/table'
import { TableObjectType } from '@/types/table'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const properties = ref<TableProperties | null>(null)
const copied = ref(false)
const ddlEditorContainer = ref<HTMLElement | null>(null)
let ddlEditor: monaco.editor.IStandaloneCodeEditor | null = null

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as TablePropertiesTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const tableName = computed(() => tabData.value?.tableName || '')
const tableType = computed(() => tabData.value?.tableType || TableObjectType.Table)
const schemaName = computed(() => tabData.value?.schema)

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
    updateDdlEditor()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load properties'
  } finally {
    loading.value = false
  }
}

const updateDdlEditor = () => {
  if (ddlEditor && properties.value?.ddl) {
    ddlEditor.setValue(properties.value.ddl)
  }
}

const initDdlEditor = () => {
  if (!ddlEditorContainer.value) return
  ddlEditor = monaco.editor.create(ddlEditorContainer.value, {
    value: properties.value?.ddl || '',
    language: 'sql',
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'none',
    folding: true,
    automaticLayout: true,
    fontSize: 13,
    padding: { top: 8, bottom: 8 }
  })
}

const copyDdl = async () => {
  if (!properties.value?.ddl) return
  try {
    await navigator.clipboard.writeText(properties.value.ddl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Ignore
  }
}

// Check if a section has any data
const hasGeneralSection = computed(() => {
  const p = properties.value
  if (!p) return false
  return !!(p.name || p.type || p.schema || p.database || p.owner || p.comment)
})

const hasStorageSection = computed(() => {
  const p = properties.value
  if (!p) return false
  return !!(p.engine || p.rowFormat || p.collation || p.charset || p.tablespace || p.pageCount || p.pageSize)
})

const hasStatisticsSection = computed(() => {
  const p = properties.value
  if (!p) return false
  return !!(
    p.rowCount !== undefined || p.totalSize || p.tableSize || p.indexSize ||
    p.dataLength || p.indexLength || p.dataFree || p.avgRowLength !== undefined ||
    p.autoIncrement !== undefined || p.columnCount !== undefined || p.indexCount !== undefined ||
    p.oid !== undefined || p.hasIndexes !== undefined || p.hasRules !== undefined || p.hasTriggers !== undefined ||
    p.totalRows !== undefined || p.totalBytes ||
    p.storageSize || p.avgObjSize || p.nindexes !== undefined ||
    p.totalIndexSize || p.capped !== undefined
  )
})

const hasKeysSection = computed(() => {
  const p = properties.value
  if (!p) return false
  return !!(p.partitionKey || p.sortingKey || p.primaryKey || p.samplingKey)
})

const hasDdlSection = computed(() => {
  return !!properties.value?.ddl
})

onMounted(() => {
  loadProperties()
})

watch([tableName, schemaName], () => {
  loadProperties()
})

// Initialize DDL editor when section becomes visible
watch([hasDdlSection, () => ddlEditorContainer.value], () => {
  if (hasDdlSection.value && ddlEditorContainer.value && !ddlEditor) {
    initDdlEditor()
  }
})

onUnmounted(() => {
  if (ddlEditor) {
    ddlEditor.dispose()
    ddlEditor = null
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <component :is="tableType === TableObjectType.View ? Eye : Table2" class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">{{ tableName }}</h1>
        </div>
        <Badge variant="outline">{{ tableType === TableObjectType.View ? 'View' : 'Table' }}</Badge>
        <Badge v-if="schemaName" variant="secondary">{{ schemaName }}</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="loadProperties">
          <RefreshCw class="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" size="lg" @click="loadProperties">
          Retry
        </Button>
      </div>

      <!-- Properties Content -->
      <div v-else-if="properties" class="space-y-6 max-w-4xl mx-auto">
        <!-- General Section -->
        <Card v-if="hasGeneralSection">
          <CardHeader>
            <CardTitle class="text-base">General</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt class="text-muted-foreground">Name</dt>
                <dd class="font-medium font-mono">{{ properties.name }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Type</dt>
                <dd class="font-medium capitalize">{{ properties.type }}</dd>
              </div>
              <div v-if="properties.schema">
                <dt class="text-muted-foreground">Schema</dt>
                <dd class="font-medium font-mono">{{ properties.schema }}</dd>
              </div>
              <div v-if="properties.database">
                <dt class="text-muted-foreground">Database</dt>
                <dd class="font-medium font-mono">{{ properties.database }}</dd>
              </div>
              <div v-if="properties.owner">
                <dt class="text-muted-foreground">Owner</dt>
                <dd class="font-medium">{{ properties.owner }}</dd>
              </div>
              <div v-if="properties.comment">
                <dt class="text-muted-foreground">Comment</dt>
                <dd class="font-medium">{{ properties.comment }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Storage Section -->
        <Card v-if="hasStorageSection">
          <CardHeader>
            <CardTitle class="text-base">Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div v-if="properties.engine">
                <dt class="text-muted-foreground">Engine</dt>
                <dd class="font-medium">{{ properties.engine }}</dd>
              </div>
              <div v-if="properties.rowFormat">
                <dt class="text-muted-foreground">Row Format</dt>
                <dd class="font-medium">{{ properties.rowFormat }}</dd>
              </div>
              <div v-if="properties.collation">
                <dt class="text-muted-foreground">Collation</dt>
                <dd class="font-medium font-mono">{{ properties.collation }}</dd>
              </div>
              <div v-if="properties.charset">
                <dt class="text-muted-foreground">Charset</dt>
                <dd class="font-medium font-mono">{{ properties.charset }}</dd>
              </div>
              <div v-if="properties.tablespace">
                <dt class="text-muted-foreground">Tablespace</dt>
                <dd class="font-medium">{{ properties.tablespace }}</dd>
              </div>
              <div v-if="properties.pageCount !== undefined">
                <dt class="text-muted-foreground">Page Count</dt>
                <dd class="font-medium font-mono">{{ properties.pageCount?.toLocaleString() }}</dd>
              </div>
              <div v-if="properties.pageSize !== undefined">
                <dt class="text-muted-foreground">Page Size</dt>
                <dd class="font-medium font-mono">{{ properties.pageSize?.toLocaleString() }} B</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Statistics Section -->
        <Card v-if="hasStatisticsSection">
          <CardHeader>
            <CardTitle class="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div v-if="properties.rowCount !== undefined">
                <dt class="text-muted-foreground">Row Count</dt>
                <dd class="font-medium font-mono">{{ properties.rowCount?.toLocaleString() }}</dd>
              </div>
              <div v-if="properties.totalSize">
                <dt class="text-muted-foreground">Total Size</dt>
                <dd class="font-medium font-mono">{{ properties.totalSize }}</dd>
              </div>
              <div v-if="properties.tableSize">
                <dt class="text-muted-foreground">Table Size</dt>
                <dd class="font-medium font-mono">{{ properties.tableSize }}</dd>
              </div>
              <div v-if="properties.indexSize">
                <dt class="text-muted-foreground">Index Size</dt>
                <dd class="font-medium font-mono">{{ properties.indexSize }}</dd>
              </div>
              <div v-if="properties.dataLength">
                <dt class="text-muted-foreground">Data Length</dt>
                <dd class="font-medium font-mono">{{ properties.dataLength }}</dd>
              </div>
              <div v-if="properties.indexLength">
                <dt class="text-muted-foreground">Index Length</dt>
                <dd class="font-medium font-mono">{{ properties.indexLength }}</dd>
              </div>
              <div v-if="properties.dataFree">
                <dt class="text-muted-foreground">Data Free</dt>
                <dd class="font-medium font-mono">{{ properties.dataFree }}</dd>
              </div>
              <div v-if="properties.avgRowLength !== undefined">
                <dt class="text-muted-foreground">Avg Row Length</dt>
                <dd class="font-medium font-mono">{{ properties.avgRowLength?.toLocaleString() }}</dd>
              </div>
              <div v-if="properties.autoIncrement !== undefined">
                <dt class="text-muted-foreground">Auto Increment</dt>
                <dd class="font-medium font-mono">{{ properties.autoIncrement?.toLocaleString() }}</dd>
              </div>
              <div v-if="properties.columnCount !== undefined">
                <dt class="text-muted-foreground">Column Count</dt>
                <dd class="font-medium font-mono">{{ properties.columnCount }}</dd>
              </div>
              <div v-if="properties.indexCount !== undefined">
                <dt class="text-muted-foreground">Index Count</dt>
                <dd class="font-medium font-mono">{{ properties.indexCount }}</dd>
              </div>
              <div v-if="properties.oid !== undefined">
                <dt class="text-muted-foreground">OID</dt>
                <dd class="font-medium font-mono">{{ properties.oid }}</dd>
              </div>
              <div v-if="properties.hasIndexes !== undefined">
                <dt class="text-muted-foreground">Has Indexes</dt>
                <dd class="font-medium">
                  <Badge :variant="properties.hasIndexes ? 'default' : 'secondary'">
                    {{ properties.hasIndexes ? 'Yes' : 'No' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="properties.hasRules !== undefined">
                <dt class="text-muted-foreground">Has Rules</dt>
                <dd class="font-medium">
                  <Badge :variant="properties.hasRules ? 'default' : 'secondary'">
                    {{ properties.hasRules ? 'Yes' : 'No' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="properties.hasTriggers !== undefined">
                <dt class="text-muted-foreground">Has Triggers</dt>
                <dd class="font-medium">
                  <Badge :variant="properties.hasTriggers ? 'default' : 'secondary'">
                    {{ properties.hasTriggers ? 'Yes' : 'No' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="properties.totalRows !== undefined">
                <dt class="text-muted-foreground">Total Rows</dt>
                <dd class="font-medium font-mono">{{ properties.totalRows?.toLocaleString() }}</dd>
              </div>
              <div v-if="properties.totalBytes">
                <dt class="text-muted-foreground">Total Bytes</dt>
                <dd class="font-medium font-mono">{{ properties.totalBytes }}</dd>
              </div>
              <div v-if="properties.storageSize">
                <dt class="text-muted-foreground">Storage Size</dt>
                <dd class="font-medium font-mono">{{ properties.storageSize }}</dd>
              </div>
              <div v-if="properties.avgObjSize">
                <dt class="text-muted-foreground">Avg Object Size</dt>
                <dd class="font-medium font-mono">{{ properties.avgObjSize }}</dd>
              </div>
              <div v-if="properties.nindexes !== undefined">
                <dt class="text-muted-foreground">Indexes</dt>
                <dd class="font-medium font-mono">{{ properties.nindexes }}</dd>
              </div>
              <div v-if="properties.totalIndexSize">
                <dt class="text-muted-foreground">Total Index Size</dt>
                <dd class="font-medium font-mono">{{ properties.totalIndexSize }}</dd>
              </div>
              <div v-if="properties.capped !== undefined">
                <dt class="text-muted-foreground">Capped</dt>
                <dd class="font-medium">
                  <Badge :variant="properties.capped ? 'default' : 'secondary'">
                    {{ properties.capped ? 'Yes' : 'No' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="properties.createTime">
                <dt class="text-muted-foreground">Created</dt>
                <dd class="font-medium">{{ properties.createTime }}</dd>
              </div>
              <div v-if="properties.updateTime">
                <dt class="text-muted-foreground">Updated</dt>
                <dd class="font-medium">{{ properties.updateTime }}</dd>
              </div>
              <div v-if="properties.metadataModificationTime">
                <dt class="text-muted-foreground">Metadata Modified</dt>
                <dd class="font-medium">{{ properties.metadataModificationTime }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Keys & Partitioning Section (ClickHouse) -->
        <Card v-if="hasKeysSection">
          <CardHeader>
            <CardTitle class="text-base">Keys &amp; Partitioning</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div v-if="properties.partitionKey">
                <dt class="text-muted-foreground">Partition Key</dt>
                <dd class="font-medium font-mono">{{ properties.partitionKey }}</dd>
              </div>
              <div v-if="properties.sortingKey">
                <dt class="text-muted-foreground">Sorting Key</dt>
                <dd class="font-medium font-mono">{{ properties.sortingKey }}</dd>
              </div>
              <div v-if="properties.primaryKey">
                <dt class="text-muted-foreground">Primary Key</dt>
                <dd class="font-medium font-mono">{{ properties.primaryKey }}</dd>
              </div>
              <div v-if="properties.samplingKey">
                <dt class="text-muted-foreground">Sampling Key</dt>
                <dd class="font-medium font-mono">{{ properties.samplingKey }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- DDL Section -->
        <Card v-if="hasDdlSection">
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-base">DDL</CardTitle>
              <Button variant="ghost" size="sm" @click="copyDdl">
                <component :is="copied ? Check : Copy" class="h-4 w-4 mr-1" />
                {{ copied ? 'Copied' : 'Copy' }}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref="ddlEditorContainer" class="h-64 border rounded-md overflow-hidden" />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
