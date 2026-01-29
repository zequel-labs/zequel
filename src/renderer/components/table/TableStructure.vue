<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { Column, Index, ForeignKey } from '@/types/table'
import { IconKey, IconLink, IconHash, IconLoader2 } from '@tabler/icons-vue'
import ScrollArea from '../ui/ScrollArea.vue'
import Badge from '../ui/Badge.vue'

interface Props {
  tableName: string
  connectionId: string
}

const props = defineProps<Props>()

const connectionsStore = useConnectionsStore()

const columns = ref<Column[]>([])
const indexes = ref<Index[]>([])
const foreignKeys = ref<ForeignKey[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const activeTab = ref<'columns' | 'indexes' | 'foreignKeys'>('columns')

async function loadStructure() {
  isLoading.value = true
  error.value = null

  try {
    const [cols, idxs, fks] = await Promise.all([
      window.api.schema.columns(props.connectionId, props.tableName),
      window.api.schema.indexes(props.connectionId, props.tableName),
      window.api.schema.foreignKeys(props.connectionId, props.tableName)
    ])

    columns.value = cols
    indexes.value = idxs
    foreignKeys.value = fks
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load table structure'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadStructure)

watch(
  () => [props.tableName, props.connectionId],
  loadStructure
)

function formatType(col: Column): string {
  let type = col.type
  if (col.length) type += `(${col.length})`
  else if (col.precision && col.scale) type += `(${col.precision},${col.scale})`
  else if (col.precision) type += `(${col.precision})`
  return type
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Tabs -->
    <div class="flex items-center gap-1 px-4 py-2 border-b bg-muted/30">
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeTab === 'columns' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeTab = 'columns'"
      >
        Columns ({{ columns.length }})
      </button>
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeTab === 'indexes' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeTab = 'indexes'"
      >
        Indexes ({{ indexes.length }})
      </button>
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeTab === 'foreignKeys' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeTab = 'foreignKeys'"
      >
        Foreign Keys ({{ foreignKeys.length }})
      </button>
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex-1 p-4"
    >
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- Columns Tab -->
    <ScrollArea v-else-if="activeTab === 'columns'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Type</th>
            <th class="px-4 py-2 text-left font-medium border-b">Nullable</th>
            <th class="px-4 py-2 text-left font-medium border-b">Default</th>
            <th class="px-4 py-2 text-left font-medium border-b">Attributes</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="col in columns"
            :key="col.name"
            class="hover:bg-muted/30"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconKey v-if="col.primaryKey" class="h-4 w-4 text-yellow-500" />
                <span class="font-medium">{{ col.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono text-blue-500">
              {{ formatType(col) }}
            </td>
            <td class="px-4 py-2 border-b">
              <Badge :variant="col.nullable ? 'secondary' : 'outline'">
                {{ col.nullable ? 'YES' : 'NO' }}
              </Badge>
            </td>
            <td class="px-4 py-2 border-b font-mono text-muted-foreground">
              {{ col.defaultValue ?? '-' }}
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex gap-1">
                <Badge v-if="col.primaryKey" variant="default">PK</Badge>
                <Badge v-if="col.autoIncrement" variant="secondary">AI</Badge>
                <Badge v-if="col.unique" variant="secondary">UQ</Badge>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollArea>

    <!-- Indexes Tab -->
    <ScrollArea v-else-if="activeTab === 'indexes'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Columns</th>
            <th class="px-4 py-2 text-left font-medium border-b">Type</th>
            <th class="px-4 py-2 text-left font-medium border-b">Attributes</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="idx in indexes"
            :key="idx.name"
            class="hover:bg-muted/30"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconHash class="h-4 w-4 text-blue-500" />
                <span class="font-medium">{{ idx.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono">
              {{ idx.columns.join(', ') }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ idx.type || 'BTREE' }}
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex gap-1">
                <Badge v-if="idx.primary" variant="default">PRIMARY</Badge>
                <Badge v-if="idx.unique && !idx.primary" variant="secondary">UNIQUE</Badge>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="indexes.length === 0"
        class="p-8 text-center text-muted-foreground"
      >
        No indexes found
      </div>
    </ScrollArea>

    <!-- Foreign Keys Tab -->
    <ScrollArea v-else-if="activeTab === 'foreignKeys'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Column</th>
            <th class="px-4 py-2 text-left font-medium border-b">References</th>
            <th class="px-4 py-2 text-left font-medium border-b">On Update</th>
            <th class="px-4 py-2 text-left font-medium border-b">On Delete</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fk in foreignKeys"
            :key="fk.name"
            class="hover:bg-muted/30"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconLink class="h-4 w-4 text-purple-500" />
                <span class="font-medium">{{ fk.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono">
              {{ fk.column }}
            </td>
            <td class="px-4 py-2 border-b font-mono text-blue-500">
              {{ fk.referencedTable }}.{{ fk.referencedColumn }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ fk.onUpdate || 'NO ACTION' }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ fk.onDelete || 'NO ACTION' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="foreignKeys.length === 0"
        class="p-8 text-center text-muted-foreground"
      >
        No foreign keys found
      </div>
    </ScrollArea>
  </div>
</template>
