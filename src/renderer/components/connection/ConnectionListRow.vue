<script setup lang="ts">
import { IconLoader2 } from '@tabler/icons-vue'
import ConnectionAvatar from '@/components/connection/ConnectionAvatar.vue'
import EnvironmentBadge from '@/components/connection/EnvironmentBadge.vue'
import { getConnectionSubtitle } from '@/lib/connection'
import type { SavedConnection } from '@/types/connection'

interface Props {
  connection: SavedConnection
  connecting?: boolean
  connected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  connecting: false,
  connected: false
})
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-2.5">
    <span class="relative shrink-0">
      <ConnectionAvatar :type="props.connection.type"
        :style="props.connection.color ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 3.5px ${props.connection.color}` } : undefined" />
      <span v-if="props.connected" class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center gap-1.5">
        <IconLoader2 v-if="props.connecting" class="size-3 shrink-0 animate-spin text-muted-foreground" />
        <span class="truncate text-[13px] font-medium">{{ props.connection.name }}</span>
        <EnvironmentBadge v-if="props.connection.environment" :environment="props.connection.environment" />
      </span>
      <span class="block truncate text-[11px] text-muted-foreground">{{ getConnectionSubtitle(props.connection) }}</span>
    </span>
  </div>
</template>
