<script setup lang="ts">
import { computed } from 'vue'
import { copyToClipboard } from '@/lib/utils'
import { useConnectionsStore } from '@/stores/connections'

import { useTabs } from '@/composables/useTabs'
import { DatabaseType } from '@/types/connection'
import { TableObjectType } from '@/types/table'
import {
  IconTable,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconDownload,
  IconPin,
  IconPinFilled
} from '@tabler/icons-vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

interface Props {
  name: string
  type: TableObjectType
  schema?: string
  dbType: DatabaseType
  isPinned: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle-pin'): void
  (e: 'export'): void
  (e: 'rename'): void
  (e: 'drop'): void
  (e: 'edit-view'): void
  (e: 'drop-view'): void
}>()

const connectionsStore = useConnectionsStore()

const { openTableTab, openViewTab, openQueryTab } = useTabs()

const currentDatabase = computed(() => {
  const connId = connectionsStore.activeSessionId
  if (!connId) return undefined
  return connectionsStore.getActiveDatabase(connId) || undefined
})

const isView = computed(() => props.type === TableObjectType.View)
const isMongo = computed(() => props.dbType === DatabaseType.MongoDB)

const entityLabel = computed(() => {
  if (isView.value) return 'View'
  if (isMongo.value) return 'Collection'
  return 'Table'
})

const qualifiedName = computed(() => {
  const { name, schema, dbType } = props
  switch (dbType) {
    case DatabaseType.PostgreSQL:
      return `"${schema}"."${name}"`
    case DatabaseType.MySQL:
    case DatabaseType.MariaDB:
      return `\`${name}\``
    case DatabaseType.SQLite:
    case DatabaseType.DuckDB:
      return `"${name}"`
    case DatabaseType.ClickHouse:
      return name
    case DatabaseType.SQLServer:
      return schema ? `[${schema}].[${name}]` : `[${name}]`
    case DatabaseType.MongoDB:
      return `db.${name}`
    default:
      return name
  }
})

const useSemicolon = computed(() => props.dbType !== DatabaseType.ClickHouse)

const queryStatement = computed(() => {
  if (isMongo.value) return `db.${props.name}.find({})`
  return `SELECT * FROM ${qualifiedName.value} LIMIT 100${useSemicolon.value ? ';' : ''}`
})

const copyStatement = computed(() => {
  if (isMongo.value) return `db.${props.name}.find({})`
  return `SELECT * FROM ${qualifiedName.value}${useSemicolon.value ? ';' : ''}`
})

const copyLabel = computed(() => {
  if (isMongo.value) return 'Copy Query'
  return 'Copy SELECT Statement'
})

const handleViewData = (): void => {
  if (isView.value) {
    openViewTab(props.name, currentDatabase.value, props.schema)
  } else {
    openTableTab(props.name, currentDatabase.value, props.schema)
  }
}

const handleQuery = (): void => {
  openQueryTab(queryStatement.value)
}

const handleCopyName = (): void => {
  copyToClipboard(props.name, '')
}

const handleCopyStatement = (): void => {
  copyToClipboard(copyStatement.value, '')
}
</script>

<template>
  <ContextMenuContent>
    <ContextMenuItem data-testid="context-menu-toggle-pin" @click="emit('toggle-pin')">
      <IconPinFilled v-if="isPinned" class="h-4 w-4 mr-2 text-amber-500" />
      <IconPin v-else class="h-4 w-4 mr-2" />
      {{ isPinned ? 'Unpin' : 'Pin to Top' }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem data-testid="context-menu-view-data" @click="handleViewData">
      <IconTable class="h-4 w-4 mr-2" />
      View Data
    </ContextMenuItem>
    <ContextMenuItem @click="handleQuery">
      <IconSql class="h-4 w-4 mr-2" />
      Query {{ entityLabel }}
    </ContextMenuItem>
    <ContextMenuItem @click="emit('export')">
      <IconDownload class="h-4 w-4 mr-2" />
      Export Data...
    </ContextMenuItem>
    <template v-if="!connectionsStore.safeMode">
      <ContextMenuSeparator />
      <template v-if="isView">
        <ContextMenuItem @click="emit('edit-view')">
          <IconPencil class="h-4 w-4 mr-2" />
          Edit View
        </ContextMenuItem>
        <ContextMenuItem @click="emit('drop-view')">
          <IconTrash class="h-4 w-4 mr-2" />
          Drop View
        </ContextMenuItem>
      </template>
      <template v-else>
        <ContextMenuItem data-testid="context-menu-rename" @click="emit('rename')">
          <IconPencil class="h-4 w-4 mr-2" />
          Rename {{ entityLabel }}
        </ContextMenuItem>
        <ContextMenuItem data-testid="context-menu-drop" @click="emit('drop')">
          <IconTrash class="h-4 w-4 mr-2" />
          Drop {{ entityLabel }}
        </ContextMenuItem>
      </template>
    </template>
    <ContextMenuSeparator />
    <ContextMenuItem data-testid="context-menu-copy-name" @click="handleCopyName">
      <IconCopy class="h-4 w-4 mr-2" />
      Copy Name
    </ContextMenuItem>
    <ContextMenuItem @click="handleCopyStatement">
      <IconCopy class="h-4 w-4 mr-2" />
      {{ copyLabel }}
    </ContextMenuItem>
  </ContextMenuContent>
</template>
