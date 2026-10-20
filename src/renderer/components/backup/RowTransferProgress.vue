<script setup lang="ts">
import { computed } from 'vue'
import { useTransferElapsed } from '@/composables/useTransferElapsed'
import type { RowTransferProgress } from '@main/services/row-transfer'
const props = defineProps<{ progress: RowTransferProgress }>()
const elapsed = useTransferElapsed(() => props.progress.startedAt, () => props.progress.finishedAt)
const percent = computed(() => props.progress.status === 'completed' ? 100 : props.progress.total
  ? Math.min(100, props.progress.processed / props.progress.total * 100) : undefined)
const label = computed(() => props.progress.status === 'cancelling' ? 'Stopping…' : props.progress.finishedAt
  ? props.progress.status : { validating: 'Validating input…', transferring: 'Transferring rows…', finalizing: 'Finalizing file…' }[props.progress.phase])
</script>
<template>
  <div class="space-y-2 py-3" aria-live="polite">
    <div class="flex justify-between gap-3 text-xs text-muted-foreground">
      <span>{{ label }} · {{ elapsed }}</span>
      <span>{{ progress.processed.toLocaleString() }}<template v-if="progress.total !== undefined"> / {{ progress.total.toLocaleString() }}</template> rows</span>
    </div>
    <div role="progressbar" :aria-label="label" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" class="h-2 overflow-hidden rounded-full bg-muted">
      <div class="h-full rounded-full bg-foreground transition-[width] motion-reduce:transition-none" :class="percent === undefined && !progress.finishedAt ? 'animate-pulse' : ''" :style="{ width: percent === undefined ? '35%' : `${percent}%` }" />
    </div>
    <p v-if="progress.applied" class="text-xs text-muted-foreground">{{ progress.applied.toLocaleString() }} rows applied. Stopping keeps changes already applied.</p>
    <p v-if="progress.bytes !== undefined" class="text-xs text-muted-foreground">{{ (progress.bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 }) }} MB processed</p>
  </div>
</template>
