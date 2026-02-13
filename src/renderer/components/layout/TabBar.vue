<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabsStore, type Tab } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import {
  IconX,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-vue'
import { cn, getEntityIcon } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { TabType, RoutineType } from '@/types/table'
import type { RoutineTabData } from '@/stores/tabs'

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

// Drag and drop state
const draggedTabId = ref<string | null>(null)
const dragOverTabId = ref<string | null>(null)
const dragOverPosition = ref<'left' | 'right' | null>(null)

const activeConnId = computed(() => connectionsStore.activeConnectionId)

const tabs = computed(() => {
  if (activeConnId.value) {
    return tabsStore.tabs.filter(t => t.data.connectionId === activeConnId.value)
  }
  return tabsStore.tabs
})

const activeTabId = computed(() => tabsStore.activeTabId)

const selectTab = (tab: Tab) => {
  tabsStore.setActiveTab(tab.id)
}

const closeTab = (event: MouseEvent, tab: Tab) => {
  event.stopPropagation()
  tabsStore.closeTab(tab.id)
}

const getTabEntity = (tab: Tab) => {
  switch (tab.data.type) {
    case TabType.Table:
    case TabType.CreateTable:
    case TabType.TableProperties:
      return getEntityIcon('table')
    case TabType.View:
      return getEntityIcon('view')
    case TabType.MaterializedView:
      return getEntityIcon('materializedView')
    case TabType.Query:
      return getEntityIcon('query')
    case TabType.Routine: {
      const routineData = tab.data as RoutineTabData
      return routineData.routineType === RoutineType.Procedure ? getEntityIcon('procedure') : getEntityIcon('function')
    }
    case TabType.Trigger:
      return getEntityIcon('trigger')
    case TabType.Event:
      return getEntityIcon('event')
    case TabType.Sequence:
      return getEntityIcon('sequence')
    case TabType.ERDiagram:
      return getEntityIcon('erDiagram')
    case TabType.Users:
      return getEntityIcon('users')
    case TabType.Monitoring:
      return getEntityIcon('monitoring')
    case TabType.Extensions:
      return getEntityIcon('extensions')
    case TabType.Enums:
      return getEntityIcon('enums')
    default:
      return getEntityIcon('table')
  }
}


const isTabDirty = (tab: Tab) => {
  return tab.data.type === TabType.Query && tab.data.isDirty
}

// Drag and drop handlers
const onDragStart = (event: DragEvent, tab: Tab) => {
  if (!event.dataTransfer) return
  draggedTabId.value = tab.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', tab.id)

  // Add visual feedback
  requestAnimationFrame(() => {
    const target = event.target as HTMLElement
    target.classList.add('opacity-50')
  })
}

const onDragEnd = (event: DragEvent) => {
  draggedTabId.value = null
  dragOverTabId.value = null
  dragOverPosition.value = null
  const target = event.target as HTMLElement
  target.classList.remove('opacity-50')
}

const onDragOver = (event: DragEvent, tab: Tab) => {
  event.preventDefault()
  if (!event.dataTransfer || !draggedTabId.value || draggedTabId.value === tab.id) return

  event.dataTransfer.dropEffect = 'move'
  dragOverTabId.value = tab.id

  // Determine if dropping to the left or right of the target
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const midpoint = rect.left + rect.width / 2
  dragOverPosition.value = event.clientX < midpoint ? 'left' : 'right'
}

const onDragLeave = () => {
  dragOverTabId.value = null
  dragOverPosition.value = null
}

const onDrop = (event: DragEvent, targetTab: Tab) => {
  event.preventDefault()

  if (!draggedTabId.value || draggedTabId.value === targetTab.id) {
    draggedTabId.value = null
    dragOverTabId.value = null
    dragOverPosition.value = null
    return
  }

  // Find indices in the full tabs array
  const allTabs = tabsStore.tabs
  const draggedIndex = allTabs.findIndex(t => t.id === draggedTabId.value)
  let targetIndex = allTabs.findIndex(t => t.id === targetTab.id)

  if (draggedIndex === -1 || targetIndex === -1) return

  // Adjust target index based on drop position
  if (dragOverPosition.value === 'right') {
    targetIndex = targetIndex + 1
  }

  // Account for the removal of the dragged item
  if (draggedIndex < targetIndex) {
    targetIndex = targetIndex - 1
  }

  tabsStore.reorderTabs(draggedIndex, targetIndex)

  draggedTabId.value = null
  dragOverTabId.value = null
  dragOverPosition.value = null
}

const activeTabIndex = computed(() => tabs.value.findIndex(t => t.id === activeTabId.value))

const goToPreviousTab = () => {
  if (tabs.value.length < 2) return
  const prevIndex = activeTabIndex.value <= 0 ? tabs.value.length - 1 : activeTabIndex.value - 1
  selectTab(tabs.value[prevIndex])
}

const goToNextTab = () => {
  if (tabs.value.length < 2) return
  const nextIndex = activeTabIndex.value >= tabs.value.length - 1 ? 0 : activeTabIndex.value + 1
  selectTab(tabs.value[nextIndex])
}

const getDropIndicatorClass = (tabId: string): string => {
  if (dragOverTabId.value !== tabId) return ''
  if (dragOverPosition.value === 'left') return 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary'
  if (dragOverPosition.value === 'right') return 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-0.5 after:bg-primary'
  return ''
}
</script>

<template>
  <div class="flex items-center border-b bg-muted/30">
    <!-- Tab navigation buttons -->
    <div v-if="tabs.length > 1" class="flex items-center gap-1 px-1.5 shrink-0">
      <Button variant="outline" size="icon" @click="goToPreviousTab">
        <IconChevronLeft class="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="icon" @click="goToNextTab">
        <IconChevronRight class="h-3.5 w-3.5" />
      </Button>
    </div>

    <div class="flex items-center flex-1 min-w-0 overflow-x-auto">
      <ContextMenu v-for="(tab, index) in tabs" :key="tab.id">
        <ContextMenuTrigger as-child>
          <div :class="cn(
            'group relative flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-border min-w-0',
            'hover:bg-muted/50 transition-colors',
            activeTabId === tab.id ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground',
            draggedTabId === tab.id ? 'opacity-50' : '',
            getDropIndicatorClass(tab.id)
          )" draggable="true" tabindex="-1" @click="selectTab(tab)" @dragstart="onDragStart($event, tab)" @dragend="onDragEnd"
            @dragover="onDragOver($event, tab)" @dragleave="onDragLeave" @drop="onDrop($event, tab)"
            :title="index < 9 ? `${tab.title} (Cmd+${index + 1})` : tab.title">
            <component :is="getTabEntity(tab).icon" :class="['h-4 w-4 shrink-0', getTabEntity(tab).color]" />

            <span class="truncate">{{ tab.title }}</span>

            <span v-if="isTabDirty(tab)" class="h-2 w-2 rounded-full bg-primary" />

            <button tabindex="-1" class="p-0.5 rounded hover:bg-muted transition-opacity shrink-0"
              :class="activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              @click="closeTab($event, tab)">
              <IconX class="h-3.5 w-3.5" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem @select="tabsStore.closeTab(tab.id)">
            Close
          </ContextMenuItem>
          <ContextMenuItem :disabled="tabs.length <= 1" @select="tabsStore.closeOtherTabs(tab.id)">
            Close Others
          </ContextMenuItem>
          <ContextMenuItem :disabled="index === 0" @select="tabsStore.closeTabsToLeft(tab.id)">
            Close to the Left
          </ContextMenuItem>
          <ContextMenuItem :disabled="index === tabs.length - 1" @select="tabsStore.closeTabsToRight(tab.id)">
            Close to the Right
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @select="tabsStore.closeAllTabs()">
            Close All
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <!-- Empty state -->
      <div v-if="tabs.length === 0" class="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
        <span>No open tabs</span>
      </div>
    </div>

  </div>
</template>