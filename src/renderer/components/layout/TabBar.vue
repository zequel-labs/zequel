<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore, type Tab } from '@/stores/tabs'
import { IconX, IconFileCode, IconTable } from '@tabler/icons-vue'
import { cn } from '@/lib/utils'

const tabsStore = useTabsStore()

const tabs = computed(() => tabsStore.tabs)
const activeTabId = computed(() => tabsStore.activeTabId)

function selectTab(tab: Tab) {
  tabsStore.setActiveTab(tab.id)
}

function closeTab(event: MouseEvent, tab: Tab) {
  event.stopPropagation()
  tabsStore.closeTab(tab.id)
}

function getTabIcon(tab: Tab) {
  return tab.data.type === 'query' ? IconFileCode : IconTable
}

function isTabDirty(tab: Tab) {
  return tab.data.type === 'query' && tab.data.isDirty
}
</script>

<template>
  <div class="flex items-center border-b bg-muted/30 overflow-x-auto min-h-[38px]">
    <div class="flex items-center">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="cn(
          'group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-border',
          'hover:bg-muted/50 transition-colors',
          activeTabId === tab.id ? 'bg-background' : ''
        )"
        @click="selectTab(tab)"
      >
        <component
          :is="getTabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="tab.data.type === 'query' ? 'text-yellow-500' : 'text-blue-500'"
        />

        <span class="truncate max-w-[150px]">{{ tab.title }}</span>

        <span
          v-if="isTabDirty(tab)"
          class="h-2 w-2 rounded-full bg-primary"
        />

        <button
          class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          @click="closeTab($event, tab)"
        >
          <IconX class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="tabs.length === 0"
      class="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground"
    >
      <span>No open tabs</span>
    </div>
  </div>
</template>
