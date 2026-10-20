import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useNow } from '@vueuse/core'

export const useTransferElapsed = (startedAt: MaybeRefOrGetter<number | undefined>, finishedAt: MaybeRefOrGetter<number | undefined>) => {
  const now = useNow({ interval: 1000 })
  return computed(() => {
    const start = toValue(startedAt)
    if (!start) return ''
    const seconds = Math.max(0, Math.floor(((toValue(finishedAt) ?? now.value.getTime()) - start) / 1000))
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor(seconds % 3600 / 60)
    return hours ? `${hours}h ${minutes}m ${seconds % 60}s` : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
  })
}
