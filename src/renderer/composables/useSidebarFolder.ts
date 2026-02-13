import { ref, computed, type WritableComputedRef } from 'vue'

export const useSidebarFolder = (searchFilter: () => string, defaultOpen = false): WritableComputedRef<boolean> => {
  const manualOpen = ref(defaultOpen)
  return computed({
    get: () => !!searchFilter() || manualOpen.value,
    set: (val: boolean) => { manualOpen.value = val }
  })
}
