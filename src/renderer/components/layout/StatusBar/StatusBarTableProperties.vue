<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import { Button } from '@/components/ui/button'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label -->
    <div class="flex items-center">
      <span class="font-medium text-foreground">Table Properties</span>
    </div>

    <!-- Center: property count -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.tablePropertiesCount }} {{ statusBarStore.tablePropertiesCount === 1 ? 'property' : 'properties' }}</span>
    </div>

    <!-- Right: copy DDL -->
    <div class="flex items-center justify-end gap-0.5">
      <Button v-if="statusBarStore.tablePropertiesHasDdl" variant="outline" @click="statusBarStore.tablePropertiesCopyDdl()">
        Copy DDL
      </Button>
    </div>
  </div>
</template>
