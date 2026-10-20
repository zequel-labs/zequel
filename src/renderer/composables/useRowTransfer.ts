import { ref, onUnmounted } from 'vue'
import type { RowTransferProgress } from '@main/services/row-transfer'

export const useRowTransfer = () => {
  const progress = ref<RowTransferProgress>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const stop = (): void => { generation++; clearTimeout(timer) }
  const begin = (): string => {
    stop()
    const current = generation
    const id = crypto.randomUUID()
    progress.value = { id, status: 'running', phase: 'validating', processed: 0, applied: 0, startedAt: Date.now() }
    const poll = async (): Promise<void> => {
      try {
        const snapshot = await window.api.rowTransfer.get(id)
        if (generation !== current) return
        if (snapshot) progress.value = snapshot
        if (snapshot?.finishedAt) return
      } catch { /* A temporarily unavailable window can reconcile on the next poll. */ }
      if (generation === current) timer = setTimeout(poll, 200)
    }
    timer = setTimeout(poll, 200)
    return id
  }
  const finish = async (): Promise<void> => {
    if (!progress.value) return
    const snapshot = await window.api.rowTransfer.get(progress.value.id)
    if (snapshot) progress.value = snapshot
    stop()
  }
  const cancel = async (): Promise<void> => {
    if (progress.value) await window.api.rowTransfer.cancel(progress.value.id)
  }
  onUnmounted(stop)
  return { progress, begin, finish, cancel }
}
