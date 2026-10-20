<script setup lang="ts">
import { computed } from 'vue'
import { useTransferElapsed } from '@/composables/useTransferElapsed'
import type { BackupProgress } from '@main/types'

const props = defineProps<{ operation: BackupProgress }>()
const elapsed = useTransferElapsed(() => props.operation.startedAt, () => props.operation.finishedAt)
const active = computed(() => ['running', 'cancelling'].includes(props.operation.status))
const percent = computed(() => {
  const metrics = props.operation.metrics
  if (props.operation.status === 'completed') return 100
  if (!metrics?.total || metrics.processed === undefined) return undefined
  return Math.min(100, Math.max(0, metrics.processed / metrics.total * 100))
})
const quantity = (value: number): string => props.operation.metrics?.unit === 'bytes'
  ? `${(value / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`
  : `${value.toLocaleString()} items`
const label = computed(() => {
  if (props.operation.status === 'cancelling') return 'Stopping operation…'
  if (!active.value) return props.operation.status === 'completed' ? 'Completed' : props.operation.status
  return {
    preparing: 'Preparing…',
    transferring: 'Transferring data…',
    applying: 'Applying changes on the database server…',
    compressing: 'Compressing backup…',
    finalizing: 'Finalizing backup…',
  }[props.operation.metrics?.phase || 'preparing']
})
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex justify-between gap-3 text-xs text-muted-foreground">
      <span>{{ label }}<template v-if="elapsed"> · {{ elapsed }}</template></span>
      <span v-if="active && operation.metrics?.processed !== undefined">
        {{ quantity(operation.metrics.processed) }}<template v-if="operation.metrics.total"> / {{ quantity(operation.metrics.total) }} · {{ Math.floor(percent || 0) }}%</template>
      </span>
    </div>
    <div role="progressbar" :aria-label="label" :aria-valuenow="percent" :aria-valuemin="0" :aria-valuemax="100"
      class="h-1.5 overflow-hidden rounded-full bg-muted">
      <div v-if="percent !== undefined" class="h-full rounded-full bg-foreground transition-[width] duration-200 motion-reduce:transition-none" :style="{ width: `${percent}%` }" />
      <div v-else-if="active" class="transfer-indeterminate h-full w-1/3 rounded-full bg-foreground/60 motion-reduce:animate-none" />
    </div>
  </div>
</template>

<style scoped>
.transfer-indeterminate { animation: transfer-progress 1.6s ease-in-out infinite; }
@keyframes transfer-progress { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
</style>
