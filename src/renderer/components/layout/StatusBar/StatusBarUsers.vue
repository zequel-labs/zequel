<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import { IconRefresh, IconPlus } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label -->
    <div class="flex items-center">
      <span class="font-medium text-foreground">User Management</span>
    </div>

    <!-- Center: user count -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.usersCount }} {{ statusBarStore.usersCount === 1 ? 'user' : 'users' }}</span>
    </div>

    <!-- Right: create + refresh -->
    <TooltipProvider :delay-duration="300">
      <div class="flex items-center justify-end gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="statusBarStore.usersRefresh()">
              <IconRefresh class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="default" size="icon" @click="statusBarStore.usersCreate()">
              <IconPlus class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create User</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>