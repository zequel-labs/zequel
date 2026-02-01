import { computed } from 'vue'

export const usePlatform = () => {
  const platform = computed(() => window.api?.platform ?? 'darwin')
  const isMac = computed(() => platform.value === 'darwin')
  const isWindows = computed(() => platform.value === 'win32')
  const isLinux = computed(() => platform.value === 'linux')
  const titlebarHeight = computed(() => isMac.value ? 38 : 0)

  return { platform, isMac, isWindows, isLinux, titlebarHeight }
}
