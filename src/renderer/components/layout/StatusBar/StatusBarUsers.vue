<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import { IconRefresh } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label -->
    <div class="flex items-center">
      <span class="font-medium text-foreground">Database Users</span>
    </div>

    <!-- Center: user count -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.usersCount }} {{ statusBarStore.usersCount === 1 ? 'user' : 'users' }}</span>
    </div>

    <!-- Right: refresh -->
    <div class="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon" @click="statusBarStore.usersRefresh()">
        <IconRefresh class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
