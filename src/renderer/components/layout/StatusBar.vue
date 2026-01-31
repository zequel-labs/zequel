<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import {
  IconClock,
  IconFilter,
  IconColumns,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
  IconEye,
  IconEyeOff
} from '@tabler/icons-vue'
import { formatDuration } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

const activeTab = computed(() => tabsStore.activeTab)

const executionTime = computed(() => {
  if (activeTab.value?.data.type === 'query' && activeTab.value.data.result) {
    return formatDuration(activeTab.value.data.result.executionTime)
  }
  return null
})

const rowCount = computed(() => {
  if (activeTab.value?.data.type === 'query' && activeTab.value.data.result) {
    return activeTab.value.data.result.rowCount
  }
  return null
})

// Pagination
const currentPage = computed(() =>
  statusBarStore.limit > 0
    ? Math.floor(statusBarStore.offset / statusBarStore.limit) + 1
    : 1
)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(statusBarStore.totalCount / statusBarStore.limit))
)

const goToPreviousPage = () => {
  const newOffset = Math.max(0, statusBarStore.offset - statusBarStore.limit)
  statusBarStore.pageChange(newOffset)
}

const goToNextPage = () => {
  const newOffset = statusBarStore.offset + statusBarStore.limit
  if (newOffset < statusBarStore.totalCount) {
    statusBarStore.pageChange(newOffset)
  }
}

// Settings popover
const settingsOpen = ref(false)
const settingsLimit = ref(statusBarStore.limit)
const settingsOffset = ref(statusBarStore.offset)

watch(settingsOpen, (open) => {
  if (open) {
    settingsLimit.value = statusBarStore.limit
    settingsOffset.value = statusBarStore.offset
  }
})

const applySettings = () => {
  statusBarStore.applySettings(settingsLimit.value, settingsOffset.value)
  settingsOpen.value = false
}

// Record range display
const recordRange = computed(() => {
  if (statusBarStore.totalCount === 0) return '0 records'
  const start = statusBarStore.offset + 1
  const end = Math.min(statusBarStore.offset + statusBarStore.limit, statusBarStore.totalCount)
  return `${start}-${end} of ${statusBarStore.totalCount}`
})
</script>

<template>
  <div class="grid grid-cols-3 items-center p-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: view tabs -->
    <div class="flex items-center gap-4">
      <div v-if="statusBarStore.viewTabs.length > 0" class="inline-flex items-center rounded-md border bg-muted p-0.5">
        <button v-for="tab in statusBarStore.viewTabs" :key="tab"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="statusBarStore.activeView === tab
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'" @click="statusBarStore.changeView(tab)">
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>
    </div>

    <!-- Center: record range / query info -->
    <div class="flex items-center justify-center gap-4">
      <template v-if="executionTime">
        <div class="flex items-center gap-1.5">
          <IconClock class="h-3.5 w-3.5" />
          <span>{{ executionTime }}</span>
        </div>
        <div v-if="rowCount !== null">
          {{ rowCount }} {{ rowCount === 1 ? 'row' : 'rows' }}
        </div>
      </template>
      <template v-if="statusBarStore.showGridControls">
        <span>{{ recordRange }}</span>
      </template>
    </div>

    <!-- Right: grid controls -->
    <div v-if="statusBarStore.showGridControls" class="flex items-center justify-end gap-1">
      <!-- Filters button -->
      <Button :variant="statusBarStore.showFilters ? 'default' : 'ghost'" size="icon" class="h-6 w-6"
        @click="statusBarStore.toggleFilters()">
        <IconFilter class="h-3.5 w-3.5" />
      </Button>
      <span v-if="statusBarStore.activeFiltersCount > 0"
        class="px-1 py-0.5 text-[10px] leading-none rounded-full bg-primary text-primary-foreground -ml-1.5 mr-0.5">
        {{ statusBarStore.activeFiltersCount }}
      </span>

      <!-- Columns dropdown -->
      <DropdownMenu v-if="statusBarStore.columns.length > 0">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="h-6 w-6">
            <IconColumns class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="max-h-64 overflow-auto">
          <DropdownMenuItem @click="statusBarStore.showAllColumns()">
            <IconEye class="h-4 w-4 mr-2" />
            Show All
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-for="col in statusBarStore.columns" :key="col.id"
            @click="statusBarStore.toggleColumn(col.id)">
            <component :is="col.visible ? IconEye : IconEyeOff"
              :class="['h-4 w-4 mr-2', col.visible ? 'text-foreground' : 'text-muted-foreground']" />
            <span :class="col.visible ? '' : 'text-muted-foreground'">{{ col.name }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="w-px h-4 bg-border mx-1" />

      <!-- Previous page -->
      <Button variant="ghost" size="icon" class="h-6 w-6"
        :disabled="currentPage <= 1 || statusBarStore.totalCount === 0" @click="goToPreviousPage">
        <IconChevronLeft class="h-3.5 w-3.5" />
      </Button>

      <!-- Settings popover -->
      <Popover v-model:open="settingsOpen">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="h-6 w-6">
            <IconSettings class="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-52 p-3" :side-offset="8">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Limit</Label>
              <Input v-model.number="settingsLimit" type="number" :min="1" class="h-7 text-xs" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Offset</Label>
              <Input v-model.number="settingsOffset" type="number" :min="0" class="h-7 text-xs" />
            </div>
            <Button size="sm" class="h-7 text-xs" @click="applySettings">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <!-- Next page -->
      <Button variant="ghost" size="icon" class="h-6 w-6"
        :disabled="currentPage >= totalPages || statusBarStore.totalCount === 0" @click="goToNextPage">
        <IconChevronRight class="h-3.5 w-3.5" />
      </Button>
    </div>
    <div v-else />
  </div>
</template>