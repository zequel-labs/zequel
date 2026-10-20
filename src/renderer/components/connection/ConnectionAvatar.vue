<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { getDatabaseAvatar } from '@/lib/connection'
import type { DatabaseType } from '@/types/connection'

interface Props {
  type: DatabaseType
  class?: string
}

const props = defineProps<Props>()
const avatar = computed(() => getDatabaseAvatar(props.type))
</script>

<template>
  <span aria-hidden="true"
    :class="cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none select-none', avatar.className, props.class)">
    {{ avatar.label }}
  </span>
</template>
