<script setup lang="ts">
import { cn } from '@/lib/utils'
import { getEnvironmentBadgeClass } from '@/lib/connection'

interface Props {
  environment: string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <span :class="cn('inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] font-medium leading-4', getEnvironmentBadgeClass(props.environment), props.class)">
    {{ props.environment }}
  </span>
</template>
