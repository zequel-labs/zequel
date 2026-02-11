<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import {
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
  IconPlus,
} from '@tabler/icons-vue'
import { formatDuration, formatNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const statusBarStore = useStatusBarStore()

const activeTab = computed(() => tabsStore.activeTab)

const executionTime = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return formatDuration(activeTab.value.data.result.executionTime)
  }
  return null
})

const rowCount = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
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
  const start = formatNumber(statusBarStore.offset + 1)
  const end = formatNumber(Math.min(statusBarStore.offset + statusBarStore.limit, statusBarStore.totalCount))
  const total = formatNumber(statusBarStore.totalCount)
  return `${start}-${end} of ${total}`
})
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: view tabs -->
    <div class="flex items-center gap-4">
      <div v-if="statusBarStore.viewTabs.length > 0" class="inline-flex items-center rounded-md border bg-muted p-0.5">
        <button v-for="tab in statusBarStore.viewTabs" :key="tab" tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="statusBarStore.activeView === tab
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'" :data-testid="`statusbar-${tab}-tab`"
          @click="statusBarStore.changeView(tab)">
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>

      <div v-if="statusBarStore.activeView === 'data' && statusBarStore.showGridControls && !settingsStore.safeMode"
        class="inline-flex items-center rounded-md border bg-muted p-0.5">
        <Button data-testid="statusbar-add-row-btn" tabindex="-1" variant="ghost" size="sm"
          @click="statusBarStore.addRow()">
          <IconPlus />
          Row
        </Button>
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
          {{ formatNumber(rowCount) }} {{ rowCount === 1 ? 'row' : 'rows' }}
        </div>
      </template>
      <template v-if="statusBarStore.showGridControls && statusBarStore.activeView !== 'structure'">
        <span data-testid="statusbar-record-range">{{ recordRange }}</span>
      </template>
    </div>

    <!-- Right: grid controls or structure changes -->
    <div
      v-if="statusBarStore.activeView === 'structure' && statusBarStore.structureChangesCount > 0 && !settingsStore.safeMode"
      class="flex items-center justify-end gap-1">
      <Button variant="ghost" @click="statusBarStore.discardStructureChanges()">
        Reset
      </Button>
      <Button @click="statusBarStore.applyStructureChanges()">
        {{ statusBarStore.structureChangesCount }} Apply
      </Button>
    </div>
    <div
      v-else-if="statusBarStore.activeView === 'data' && statusBarStore.dataChangesCount > 0 && !settingsStore.safeMode"
      class="flex items-center justify-end gap-1">
      <Button data-testid="discard-data-changes-btn" variant="ghost" @click="statusBarStore.discardDataChanges()">
        Reset
      </Button>
      <Button data-testid="apply-data-changes-btn" @click="statusBarStore.applyDataChanges()">
        {{ statusBarStore.dataChangesCount }} Apply
      </Button>
    </div>
    <div v-else-if="statusBarStore.showGridControls && statusBarStore.activeView !== 'structure'"
      class="flex items-center justify-end gap-1">
      <template v-if="statusBarStore.totalCount > 0">
        <!-- Previous page -->
        <Button data-testid="statusbar-prev-page-btn" variant="ghost" size="icon" :disabled="currentPage <= 1"
          @click="goToPreviousPage">
          <IconChevronLeft class="h-3.5 w-3.5" />
        </Button>

        <!-- Settings popover -->
        <Popover v-model:open="settingsOpen">
          <PopoverTrigger as-child>
            <Button data-testid="statusbar-settings-btn" variant="ghost" size="icon">
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
              <Button data-testid="statusbar-settings-apply" @click="applySettings">
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <!-- Next page -->
        <Button data-testid="statusbar-next-page-btn" variant="ghost" size="icon" :disabled="currentPage >= totalPages"
          @click="goToNextPage">
          <IconChevronRight class="h-3.5 w-3.5" />
        </Button>

        <div class="w-px h-4 bg-border mx-0.5" />
      </template>

      <!-- Export -->
      <Button data-testid="statusbar-export-btn" variant="outline" @click="statusBarStore.exportData()">
        Export
      </Button>
    </div>
    <div v-else />
  </div>
</template>