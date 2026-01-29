<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  IconRefresh,
  IconDownload,
  IconUpload,
  IconFilter,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconPlus,
  IconTrash,
  IconFileTypeCsv,
  IconJson,
  IconFileTypeSql,
  IconFileSpreadsheet,
  IconColumns,
  IconEye,
  IconEyeOff
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

export type ExportFormat = 'csv' | 'json' | 'sql' | 'xlsx'
export type ImportFormat = 'csv' | 'json' | 'sql'

export interface ColumnVisibilityItem {
  id: string
  name: string
  visible: boolean
}

interface Props {
  totalCount: number
  offset: number
  limit: number
  isLoading?: boolean
  showFilters?: boolean
  activeFiltersCount?: number
  editable?: boolean
  selectedCount?: number
  columns?: ColumnVisibilityItem[]
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
  selectedCount: 0
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'export', format: ExportFormat): void
  (e: 'import', format: ImportFormat): void
  (e: 'page-change', offset: number): void
  (e: 'filter'): void
  (e: 'add-row'): void
  (e: 'delete-selected'): void
  (e: 'toggle-column', columnId: string): void
  (e: 'show-all-columns'): void
}>()

const currentPage = ref(Math.floor(props.offset / props.limit) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.totalCount / props.limit)))

watch([() => props.offset, () => props.limit, () => props.totalCount], () => {
  currentPage.value = Math.floor(props.offset / props.limit) + 1
})

function goToPage(page: number) {
  const newPage = Math.max(1, Math.min(page, totalPages.value))
  const newOffset = (newPage - 1) * props.limit
  currentPage.value = newPage
  emit('page-change', newOffset)
}

function goToFirstPage() {
  goToPage(1)
}

function goToPreviousPage() {
  goToPage(currentPage.value - 1)
}

function goToNextPage() {
  goToPage(currentPage.value + 1)
}

function goToLastPage() {
  goToPage(totalPages.value)
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <IconRefresh :class="['h-4 w-4 mr-1', isLoading ? 'animate-spin' : '']" />
        Refresh
      </Button>

      <Button
        :variant="showFilters ? 'default' : 'ghost'"
        size="sm"
        @click="emit('filter')"
      >
        <IconFilter class="h-4 w-4 mr-1" />
        Filter
        <span
          v-if="activeFiltersCount && activeFiltersCount > 0"
          class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground text-primary"
        >
          {{ activeFiltersCount }}
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
            <IconDownload class="h-4 w-4 mr-1" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @click="emit('export', 'csv')">
            <IconFileTypeCsv class="h-4 w-4 mr-2" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('export', 'json')">
            <IconJson class="h-4 w-4 mr-2" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('export', 'sql')">
            <IconFileTypeSql class="h-4 w-4 mr-2" />
            Export as SQL
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('export', 'xlsx')">
            <IconFileSpreadsheet class="h-4 w-4 mr-2 text-green-600" />
            Export as Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
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

      <DropdownMenu v-if="columns && columns.length > 0">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
            <IconColumns class="h-4 w-4 mr-1" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="max-h-64 overflow-auto">
          <DropdownMenuItem @click="emit('show-all-columns')">
            <IconEye class="h-4 w-4 mr-2" />
            Show All
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-for="col in columns"
            :key="col.id"
            @click="emit('toggle-column', col.id)"
          >
            <component
              :is="col.visible ? IconEye : IconEyeOff"
              :class="['h-4 w-4 mr-2', col.visible ? 'text-foreground' : 'text-muted-foreground']"
            />
            <span :class="col.visible ? '' : 'text-muted-foreground'">{{ col.name }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <template v-if="editable">
        <div class="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          @click="emit('add-row')"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Row
        </Button>

        <Button
          v-if="selectedCount > 0"
          variant="ghost"
          size="sm"
          class="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          @click="emit('delete-selected')"
        >
          <IconTrash class="h-4 w-4 mr-1" />
          Delete ({{ selectedCount }})
        </Button>
      </template>
    </div>

    <div class="flex items-center gap-4">
      <span class="text-sm text-muted-foreground">
        <template v-if="totalCount > 0">
          {{ offset + 1 }}-{{ Math.min(offset + limit, totalCount) }} of {{ totalCount }}
        </template>
        <template v-else>
          0 records
        </template>
      </span>

      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === 1 || totalCount === 0"
          @click="goToFirstPage"
        >
          <IconChevronsLeft class="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === 1 || totalCount === 0"
          @click="goToPreviousPage"
        >
          <IconChevronLeft class="h-4 w-4" />
        </Button>

        <div class="flex items-center gap-1 text-sm">
          <span>Page</span>
          <Input
            :model-value="String(currentPage)"
            type="number"
            class="w-14 h-8 text-center"
            :disabled="totalCount === 0"
            @change="goToPage(Number(($event.target as HTMLInputElement).value))"
          />
          <span>of {{ totalPages }}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === totalPages || totalCount === 0"
          @click="goToNextPage"
        >
          <IconChevronRight class="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === totalPages || totalCount === 0"
          @click="goToLastPage"
        >
          <IconChevronsRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
