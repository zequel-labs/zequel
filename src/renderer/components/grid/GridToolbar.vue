<script setup lang="ts">
import {
  IconRefresh,
  IconUpload,
  IconPlus,
  IconTrash,
  IconFileTypeCsv,
  IconJson,
  IconFileTypeSql,
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export type ImportFormat = 'csv' | 'json' | 'sql'

export interface ColumnVisibilityItem {
  id: string
  name: string
  visible: boolean
}

interface Props {
  isLoading?: boolean
  editable?: boolean
  selectedCount?: number
}

withDefaults(defineProps<Props>(), {
  editable: false,
  selectedCount: 0
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'import', format: ImportFormat): void
  (e: 'add-row'): void
  (e: 'delete-selected'): void
}>()
</script>

<template>
  <div class="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-xs">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <IconRefresh :class="['h-4 w-4 mr-1', isLoading ? 'animate-spin' : '']" />
        Refresh
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost">
            <IconUpload class="h-4 w-4 mr-1" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @click="emit('import', 'csv')">
            <IconFileTypeCsv class="h-4 w-4 mr-2" />
            Import CSV
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('import', 'json')">
            <IconJson class="h-4 w-4 mr-2" />
            Import JSON
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('import', 'sql')">
            <IconFileTypeSql class="h-4 w-4 mr-2" />
            Import SQL
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <template v-if="editable">
        <div class="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          @click="emit('add-row')"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Row
        </Button>

        <Button
          v-if="selectedCount > 0"
          variant="ghost"
          class="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          @click="emit('delete-selected')"
        >
          <IconTrash class="h-4 w-4 mr-1" />
          Delete ({{ selectedCount }})
        </Button>
      </template>
    </div>
  </div>
</template>
