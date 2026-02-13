<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import { IconRefresh } from '@tabler/icons-vue'
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
  <div class="flex items-center justify-end h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <TooltipProvider :delay-duration="300">
      <div class="flex items-center gap-0.5">
        <div class="flex items-center border rounded-md overflow-hidden mr-1">
          <button
            :class="[
              'px-2.5 py-1 text-[11px] transition-colors',
              statusBarStore.extensionsActiveTab === 'installed'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            ]"
            @click="statusBarStore.extensionsTabChange('installed')"
          >
            Installed
          </button>
          <button
            :class="[
              'px-2.5 py-1 text-[11px] transition-colors border-l',
              statusBarStore.extensionsActiveTab === 'available'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            ]"
            @click="statusBarStore.extensionsTabChange('available')"
          >
            Available
          </button>
        </div>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="statusBarStore.extensionsRefresh()">
              <IconRefresh class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>
