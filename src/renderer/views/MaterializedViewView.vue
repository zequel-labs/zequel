<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type MaterializedViewTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Layers, RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { MaterializedView, DataResult } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const matView = ref<MaterializedView | null>(null)
const dataResult = ref<DataResult | null>(null)
const refreshing = ref(false)
const refreshConcurrently = ref(false)

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as MaterializedViewTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const viewName = computed(() => tabData.value?.viewName || '')
const schemaName = computed(() => tabData.value?.schema)
const activeView = computed(() => 'data')

const loadMatView = async () => {
  if (!connectionId.value || !viewName.value) return

  loading.value = true
  error.value = null

  try {
    // Get materialized views to find our view
    const views = await window.api.schema.getMaterializedViews(
      connectionId.value,
      schemaName.value
    )
    matView.value = views.find(v => v.name === viewName.value) || null

    // Get data
    await loadData()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load materialized view'
    console.error('Error loading materialized view:', err)
  } finally {
    loading.value = false
  }
}

const loadData = async () => {
  try {
    const fullName = schemaName.value
      ? `"${schemaName.value}"."${viewName.value}"`
      : `"${viewName.value}"`
    const result = await window.api.query.execute(
      connectionId.value,
      `SELECT * FROM ${fullName} LIMIT 1000`
    )

    if (!result.error) {
      dataResult.value = {
        columns: result.columns,
        rows: result.rows,
        totalCount: result.rowCount,
        offset: 0,
        limit: 1000
      }
    }
  } catch (err) {
    console.error('Error loading data:', err)
  }
}

const refreshMatView = async () => {
  if (!connectionId.value || !viewName.value) return

  refreshing.value = true

  try {
    const result = await window.api.schema.refreshMaterializedView(connectionId.value, {
      viewName: viewName.value,
      schema: schemaName.value,
      concurrently: refreshConcurrently.value
    })

    if (result.success) {
      toast.success('Materialized view refreshed successfully')
      await loadData()
    } else {
      toast.error(`Failed to refresh: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to refresh materialized view')
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  loadMatView()
})

watch([viewName, schemaName], () => {
  loadMatView()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Layers class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">{{ viewName }}</h1>
        </div>
        <Badge variant="outline">Materialized View</Badge>
        <Badge v-if="schemaName" variant="secondary">
          {{ schemaName }}
        </Badge>
        <Badge v-if="matView?.isPopulated" variant="default">Populated</Badge>
        <Badge v-else-if="matView?.isPopulated === false" variant="destructive">Not Populated</Badge>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center space-x-2 mr-2">
          <Checkbox
            id="concurrent"
            :checked="refreshConcurrently"
            @update:checked="refreshConcurrently = $event"
          />
          <Label for="concurrent" class="text-sm">Concurrent</Label>
        </div>
        <Button
          variant="default"
          size="sm"
          @click="refreshMatView"
          :disabled="refreshing"
        >
          <Loader2 v-if="refreshing" class="h-4 w-4 mr-2 animate-spin" />
          <RefreshCw v-else class="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
        <Button variant="outline" size="sm" @click="loadMatView">
          Reload
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" @click="loadMatView">
          Retry
        </Button>
      </div>

      <!-- View Content -->
      <div v-else class="h-full flex flex-col p-4">
        <div v-if="dataResult && dataResult.rows.length > 0" class="border rounded-lg overflow-auto flex-1">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 sticky top-0">
              <tr>
                <th
                  v-for="col in dataResult.columns"
                  :key="col.name"
                  class="px-4 py-2 text-left font-medium border-b"
                >
                  {{ col.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in dataResult.rows"
                :key="idx"
                class="border-b last:border-0 hover:bg-muted/30"
              >
                <td
                  v-for="col in dataResult.columns"
                  :key="col.name"
                  class="px-4 py-2 font-mono text-xs"
                >
                  {{ row[col.name] ?? 'NULL' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center text-muted-foreground py-8">
          No data available. The materialized view may not be populated.
        </div>
      </div>
    </div>
  </div>
</template>
