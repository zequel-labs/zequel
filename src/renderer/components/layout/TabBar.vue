<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabsStore, type Tab } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import {
  IconX,
  IconSql,
  IconTable,
  IconEye,
  IconSchema,
  IconFunction,
  IconUsers,
  IconCalendarEvent,
  IconActivity,
  IconBolt,
  IconList,
  IconRefresh,
  IconPackage,
  IconTags,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TabType } from '@/types/table'

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

const getTabIcon = (tab: Tab) => {
  if (tab.data.type === TabType.Query) return IconSql
  if (tab.data.type === TabType.View) return IconEye
  if (tab.data.type === TabType.ERDiagram) return IconSchema
  if (tab.data.type === TabType.Routine) return IconFunction
  if (tab.data.type === TabType.Users) return IconUsers
  if (tab.data.type === TabType.Event) return IconCalendarEvent
  if (tab.data.type === TabType.Monitoring) return IconActivity
  if (tab.data.type === TabType.Trigger) return IconBolt
  if (tab.data.type === TabType.Sequence) return IconList
  if (tab.data.type === TabType.MaterializedView) return IconRefresh
  if (tab.data.type === TabType.Extensions) return IconPackage
  if (tab.data.type === TabType.Enums) return IconTags
  return IconTable
}

const getTabIconColor = (tab: Tab) => {
  if (tab.data.type === TabType.Query) return 'text-blue-500'
  if (tab.data.type === TabType.View) return 'text-purple-500'
  if (tab.data.type === TabType.ERDiagram) return 'text-green-500'
  if (tab.data.type === TabType.Routine) return 'text-orange-500'
  if (tab.data.type === TabType.Users) return 'text-cyan-500'
  if (tab.data.type === TabType.Event) return 'text-pink-500'
  if (tab.data.type === TabType.Monitoring) return 'text-red-500'
  if (tab.data.type === TabType.Trigger) return 'text-amber-500'
  if (tab.data.type === TabType.Sequence) return 'text-indigo-500'
  if (tab.data.type === TabType.MaterializedView) return 'text-teal-500'
  if (tab.data.type === TabType.Extensions) return 'text-violet-500'
  if (tab.data.type === TabType.Enums) return 'text-lime-500'
  return 'text-blue-500'
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
      <Button variant="outline" size="icon" class="h-6 w-6" @click="goToPreviousTab">
        <IconChevronLeft class="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="icon" class="h-6 w-6" @click="goToNextTab">
        <IconChevronRight class="h-3.5 w-3.5" />
      </Button>
    </div>

    <div class="flex items-center flex-1 min-w-0 overflow-x-auto">
      <div v-for="(tab, index) in tabs" :key="tab.id" :class="cn(
        'group relative flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-border flex-1 min-w-0',
        'hover:bg-muted/50 transition-colors',
        activeTabId === tab.id ? 'bg-muted text-foreground' : 'text-muted-foreground',
        draggedTabId === tab.id ? 'opacity-50' : '',
        getDropIndicatorClass(tab.id)
      )" draggable="true" @click="selectTab(tab)" @dragstart="onDragStart($event, tab)" @dragend="onDragEnd"
        @dragover="onDragOver($event, tab)" @dragleave="onDragLeave" @drop="onDrop($event, tab)"
        :title="index < 9 ? `${tab.title} (Cmd+${index + 1})` : tab.title">
        <button class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity shrink-0"
          @click="closeTab($event, tab)">
          <IconX class="h-3.5 w-3.5" />
        </button>

        <component :is="getTabIcon(tab)" class="h-4 w-4 shrink-0" :class="getTabIconColor(tab)" />

        <span class="truncate">{{ tab.title }}</span>

        <span v-if="isTabDirty(tab)" class="h-2 w-2 rounded-full bg-primary" />
      </div>

      <!-- Empty state -->
      <div v-if="tabs.length === 0" class="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
        <span>No open tabs</span>
      </div>
    </div>

  </div>
</template>