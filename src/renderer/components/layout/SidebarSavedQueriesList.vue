<script setup lang="ts">
import type { SavedQuery } from '@/types/electron'
import { truncate } from '@/lib/utils'
import {
  IconSql,
  IconCopy,
  IconPlayerPlay,
  IconPencil,
  IconTrash,
  IconPlus,
  IconLoader2,
  IconBookmark
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

interface Props {
  queries: SavedQuery[]
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'run', query: SavedQuery): void
  (e: 'edit', query: SavedQuery): void
  (e: 'delete', query: SavedQuery): void
  (e: 'new'): void
  (e: 'copy', query: SavedQuery): void
}>()
</script>

<template>
  <div class="space-y-0.5 py-2">
    <!-- Save Query button -->
    <div class="flex items-center justify-end px-2 pb-1">
      <Button variant="outline" size="sm" @click="emit('new')">
        Save Query
      </Button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
    </div>

    <!-- Saved queries -->
    <template v-else>
      <template v-for="query in queries" :key="query.id">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-md group" @click="emit('run', query)">
              <!-- Name -->
              <div class="flex items-center gap-1.5">
                <IconSql class="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span class="text-sm truncate font-medium">{{ query.name }}</span>
              </div>
              <!-- Description -->
              <p v-if="query.description" class="text-xs text-muted-foreground mt-0.5 truncate pl-5">{{
                query.description }}</p>
              <!-- SQL preview -->
              <p class="text-xs font-mono text-foreground/50 mt-0.5 line-clamp-1 break-all pl-5">{{ truncate(query.sql,
                100) }}</p>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="emit('run', query)">
              <IconPlayerPlay class="h-4 w-4 mr-2" />
              Open in Editor
            </ContextMenuItem>
            <ContextMenuItem @click="emit('copy', query)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy SQL
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="emit('edit', query)">
              <IconPencil class="h-4 w-4 mr-2" />
              Edit
            </ContextMenuItem>
            <ContextMenuItem @click="emit('delete', query)">
              <IconTrash class="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>

      <!-- Empty state -->
      <div v-if="!loading && queries.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <IconBookmark class="h-6 w-6 mb-2 opacity-50" />
        <span class="text-xs">No saved queries</span>
        <Button variant="link" size="sm" class="text-xs mt-1 h-auto p-0" @click="emit('new')">
          Save your first query
        </Button>
      </div>
    </template>
  </div>
</template>