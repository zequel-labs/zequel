import { effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useNow } from '@vueuse/core'
import { useTransferElapsed } from '@/composables/useTransferElapsed'

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  const now = ref(new Date('2026-10-20T12:00:00Z'))
  return { useNow: () => now }
})

describe('useTransferElapsed', () => {
  it('advances while running and freezes at completion', () => {
    const now = useNow()
    const scope = effectScope()
    const start = ref<number | undefined>()
    const end = ref<number | undefined>()
    const elapsed = scope.run(() => useTransferElapsed(start, end))!
    expect(elapsed.value).toBe('')
    start.value = now.value.getTime()
    now.value = new Date(start.value + 65_000)
    expect(elapsed.value).toBe('1m 5s')
    end.value = now.value.getTime()
    now.value = new Date(end.value + 10_000)
    expect(elapsed.value).toBe('1m 5s')
    scope.stop()
  })
})
