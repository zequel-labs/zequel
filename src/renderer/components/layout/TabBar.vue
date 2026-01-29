<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabsStore, type Tab } from '@/stores/tabs'
import { useSplitViewStore } from '@/stores/splitView'
import {
  IconX,
  IconFileCode,
  IconTable,
  IconEye,
  IconSchema,
  IconLayoutColumns,
  IconLayoutRows,
  IconArrowsMaximize,
  IconFunction,
  IconUsers,
  IconCalendarEvent,
  IconActivity,
  IconBolt,
  IconList,
  IconRefresh,
  IconPackage,
  IconTags
} from '@tabler/icons-vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Props {
  panelId?: string
}

const props = withDefaults(defineProps<Props>(), {
  panelId: 'main'
})

const tabsStore = useTabsStore()
const splitViewStore = useSplitViewStore()

// Drag and drop state
const draggedTabId = ref<string | null>(null)
const dragOverTabId = ref<string | null>(null)
const dragOverPosition = ref<'left' | 'right' | null>(null)

const panel = computed(() => {
  return splitViewStore.panels.find(p => p.id === props.panelId)
})

const tabs = computed(() => {
  if (!panel.value) return tabsStore.tabs
  return tabsStore.tabs.filter(t => panel.value!.tabIds.includes(t.id))
})

const activeTabId = computed(() => {
  return panel.value?.activeTabId || tabsStore.activeTabId
})

function selectTab(tab: Tab) {
  if (panel.value) {
    splitViewStore.setActivePanelTab(props.panelId, tab.id)
  } else {
    tabsStore.setActiveTab(tab.id)
  }
}

function closeTab(event: MouseEvent, tab: Tab) {
  event.stopPropagation()
  splitViewStore.removeTabFromPanels(tab.id)
  tabsStore.closeTab(tab.id)
}

function getTabIcon(tab: Tab) {
  if (tab.data.type === 'query') return IconFileCode
  if (tab.data.type === 'view') return IconEye
  if (tab.data.type === 'er-diagram') return IconSchema
  if (tab.data.type === 'routine') return IconFunction
  if (tab.data.type === 'users') return IconUsers
  if (tab.data.type === 'event') return IconCalendarEvent
  if (tab.data.type === 'monitoring') return IconActivity
  if (tab.data.type === 'trigger') return IconBolt
  if (tab.data.type === 'sequence') return IconList
  if (tab.data.type === 'materialized-view') return IconRefresh
  if (tab.data.type === 'extensions') return IconPackage
  if (tab.data.type === 'enums') return IconTags
  return IconTable
}

function getTabIconColor(tab: Tab) {
  if (tab.data.type === 'query') return 'text-yellow-500'
  if (tab.data.type === 'view') return 'text-purple-500'
  if (tab.data.type === 'er-diagram') return 'text-green-500'
  if (tab.data.type === 'routine') return 'text-orange-500'
  if (tab.data.type === 'users') return 'text-cyan-500'
  if (tab.data.type === 'event') return 'text-pink-500'
  if (tab.data.type === 'monitoring') return 'text-red-500'
  if (tab.data.type === 'trigger') return 'text-amber-500'
  if (tab.data.type === 'sequence') return 'text-indigo-500'
  if (tab.data.type === 'materialized-view') return 'text-teal-500'
  if (tab.data.type === 'extensions') return 'text-violet-500'
  if (tab.data.type === 'enums') return 'text-lime-500'
  return 'text-blue-500'
}

function isTabDirty(tab: Tab) {
  return tab.data.type === 'query' && tab.data.isDirty
}

function handleSplit(direction: 'vertical' | 'horizontal') {
  splitViewStore.split(direction)
}

function handleUnsplit() {
  splitViewStore.unsplit()
}

function moveToOtherPanel(event: MouseEvent, tab: Tab) {
  event.stopPropagation()
  const targetPanelId = props.panelId === 'main' ? 'secondary' : 'main'
  splitViewStore.moveTabToPanel(tab.id, targetPanelId)
}

// Drag and drop handlers
function onDragStart(event: DragEvent, tab: Tab) {
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

function onDragEnd(event: DragEvent) {
  draggedTabId.value = null
  dragOverTabId.value = null
  dragOverPosition.value = null
  const target = event.target as HTMLElement
  target.classList.remove('opacity-50')
}

function onDragOver(event: DragEvent, tab: Tab) {
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

function onDragLeave() {
  dragOverTabId.value = null
  dragOverPosition.value = null
}

function onDrop(event: DragEvent, targetTab: Tab) {
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

function getDropIndicatorClass(tabId: string): string {
  if (dragOverTabId.value !== tabId) return ''
  if (dragOverPosition.value === 'left') return 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary'
  if (dragOverPosition.value === 'right') return 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-0.5 after:bg-primary'
  return ''
}
</script>

<template>
  <div class="flex items-center border-b bg-muted/30 overflow-x-auto min-h-[38px]">
    <div class="flex items-center flex-1">
      <div
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :class="cn(
          'group relative flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-border',
          'hover:bg-muted/50 transition-colors',
          activeTabId === tab.id ? 'bg-background' : '',
          draggedTabId === tab.id ? 'opacity-50' : '',
          getDropIndicatorClass(tab.id)
        )"
        draggable="true"
        @click="selectTab(tab)"
        @dragstart="onDragStart($event, tab)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, tab)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, tab)"
        :title="index < 9 ? `${tab.title} (Cmd+${index + 1})` : tab.title"
      >
        <component
          :is="getTabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="getTabIconColor(tab)"
        />

        <span class="truncate max-w-[150px]">{{ tab.title }}</span>

        <span
          v-if="index < 9"
          class="hidden group-hover:inline-block text-[10px] text-muted-foreground opacity-60 ml-1"
        >
          {{ index + 1 }}
        </span>

        <span
          v-if="isTabDirty(tab)"
          class="h-2 w-2 rounded-full bg-primary"
        />

        <!-- Move to other panel button (only in split mode) -->
        <button
          v-if="splitViewStore.isSplit"
          class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          @click="moveToOtherPanel($event, tab)"
          title="Move to other panel"
        >
          <IconArrowsMaximize class="h-3 w-3 text-muted-foreground" />
        </button>

        <button
          class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          @click="closeTab($event, tab)"
        >
          <IconX class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="tabs.length === 0"
        class="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground"
      >
        <span>No open tabs</span>
      </div>
    </div>

    <!-- Split controls (only show in main panel) -->
    <div v-if="panelId === 'main'" class="flex items-center gap-1 px-2 border-l">
      <Button
        v-if="!splitViewStore.isSplit"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="handleSplit('vertical')"
        title="Split vertically"
      >
        <IconLayoutColumns class="h-4 w-4" />
      </Button>
      <Button
        v-if="!splitViewStore.isSplit"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="handleSplit('horizontal')"
        title="Split horizontally"
      >
        <IconLayoutRows class="h-4 w-4" />
      </Button>
      <Button
        v-if="splitViewStore.isSplit"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="handleUnsplit"
        title="Close split"
      >
        <IconX class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
