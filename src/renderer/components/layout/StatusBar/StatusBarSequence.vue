<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import { IconRefresh, IconPlayerPlay } from '@tabler/icons-vue'
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
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="statusBarStore.sequenceGetNextValue()">
              <IconPlayerPlay class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Get Next Value</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="statusBarStore.sequenceRefresh()">
              <IconRefresh class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>
