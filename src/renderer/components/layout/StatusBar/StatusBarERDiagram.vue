<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import {
  IconZoomIn,
  IconZoomOut,
  IconFocus2,
  IconLayoutDistributeHorizontal,
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label -->
    <div class="flex items-center">
      <span class="font-medium text-foreground">ER Diagram</span>
    </div>

    <!-- Center: stats -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.erDiagramTableCount }} tables, {{ statusBarStore.erDiagramRelationshipCount }} relationships</span>
    </div>

    <!-- Right: zoom/layout controls -->
    <div class="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon" @click="statusBarStore.erZoomOut()">
        <IconZoomOut class="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" @click="statusBarStore.erZoomIn()">
        <IconZoomIn class="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" @click="statusBarStore.erFitView()">
        <IconFocus2 class="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" @click="statusBarStore.erResetLayout()">
        <IconLayoutDistributeHorizontal class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
