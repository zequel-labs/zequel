<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  IconCopy,
  IconCheck,
  IconCode,
  IconPhoto,
  IconFileText,
  IconBraces,
  IconDownload,
  IconMaximize,
  IconMinimize
} from '@tabler/icons-vue'

interface Props {
  open: boolean
  value: unknown
  columnName: string
  columnType?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const copied = ref(false)
const isFullscreen = ref(false)

type ViewMode = 'raw' | 'formatted' | 'hex' | 'image'

const viewMode = ref<ViewMode>('formatted')

const detectedType = computed((): 'json' | 'xml' | 'html' | 'binary' | 'image' | 'text' | 'null' => {
  if (props.value === null || props.value === undefined) return 'null'

  const str = String(props.value)
  const lowerType = (props.columnType || '').toLowerCase()

  // Check for binary/blob types
  if (lowerType.includes('blob') || lowerType.includes('binary') || lowerType.includes('bytea')) {
    // Check if it might be an image
    if (str.startsWith('/9j/') || str.startsWith('iVBOR') || str.startsWith('R0lGOD') ||
        str.startsWith('UklGR') || str.startsWith('Qk')) {
      return 'image'
    }
    return 'binary'
  }

  // Check for image column name hints
  if (/\b(image|photo|avatar|thumbnail|icon|logo|picture|img)\b/i.test(props.columnName)) {
    if (str.startsWith('data:image') || str.startsWith('http') || str.startsWith('/9j/') || str.startsWith('iVBOR')) {
      return 'image'
    }
  }

  // Check for JSON
  if (typeof props.value === 'object') return 'json'
  if (lowerType === 'json' || lowerType === 'jsonb') return 'json'
  try {
    const trimmed = str.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      JSON.parse(trimmed)
      return 'json'
    }
  } catch { /* not json */ }

  // Check for XML/HTML
  if (lowerType === 'xml') return 'xml'
  const trimmedStr = str.trim()
  if (trimmedStr.startsWith('<?xml') || (trimmedStr.startsWith('<') && trimmedStr.endsWith('>'))) {
    if (/<html/i.test(trimmedStr)) return 'html'
    return 'xml'
  }

  return 'text'
})

const formattedValue = computed(() => {
  if (props.value === null) return 'NULL'
  if (props.value === undefined) return ''

  const str = String(props.value)

  if (viewMode.value === 'raw') return str

  if (viewMode.value === 'hex') {
    return hexDump(str)
  }

  switch (detectedType.value) {
    case 'json':
      try {
        const parsed = typeof props.value === 'object' ? props.value : JSON.parse(str)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return str
      }

    case 'xml':
    case 'html':
      return formatXml(str)

    case 'null':
      return 'NULL'

    default:
      return str
  }
})

const imageUrl = computed(() => {
  if (detectedType.value !== 'image') return null
  const str = String(props.value)
  if (str.startsWith('data:image') || str.startsWith('http')) return str
  // Try base64 decode
  if (str.startsWith('/9j/')) return `data:image/jpeg;base64,${str}`
  if (str.startsWith('iVBOR')) return `data:image/png;base64,${str}`
  if (str.startsWith('R0lGOD')) return `data:image/gif;base64,${str}`
  return null
})

const valueSize = computed(() => {
  if (props.value === null || props.value === undefined) return '0 B'
  const bytes = new Blob([String(props.value)]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const availableViewModes = computed((): { mode: ViewMode; label: string; icon: typeof IconCode }[] => {
  const modes: { mode: ViewMode; label: string; icon: typeof IconCode }[] = [
    { mode: 'raw', label: 'Raw', icon: IconFileText }
  ]

  if (detectedType.value === 'json' || detectedType.value === 'xml' || detectedType.value === 'html') {
    modes.unshift({ mode: 'formatted', label: 'Formatted', icon: IconBraces })
  }

  if (detectedType.value === 'binary') {
    modes.push({ mode: 'hex', label: 'Hex', icon: IconCode })
  }

  if (detectedType.value === 'image') {
    modes.unshift({ mode: 'image', label: 'Image', icon: IconPhoto })
  }

  return modes
})

const formatXml = (xml: string): string => {
  let formatted = ''
  let indent = 0
  const lines = xml.replace(/>\s*</g, '>\n<').split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1)
    }

    formatted += '  '.repeat(indent) + trimmed + '\n'

    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<?') &&
        !trimmed.endsWith('/>') && !trimmed.includes('</')) {
      indent++
    }
  }

  return formatted.trimEnd()
}

const hexDump = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  const lines: string[] = []

  for (let i = 0; i < bytes.length; i += 16) {
    const hex: string[] = []
    const ascii: string[] = []

    for (let j = 0; j < 16; j++) {
      if (i + j < bytes.length) {
        hex.push(bytes[i + j].toString(16).padStart(2, '0'))
        ascii.push(bytes[i + j] >= 32 && bytes[i + j] <= 126 ? String.fromCharCode(bytes[i + j]) : '.')
      } else {
        hex.push('  ')
        ascii.push(' ')
      }
    }

    const offset = i.toString(16).padStart(8, '0')
    lines.push(`${offset}  ${hex.slice(0, 8).join(' ')}  ${hex.slice(8).join(' ')}  |${ascii.join('')}|`)
  }

  return lines.join('\n')
}

const copyValue = async () => {
  const text = viewMode.value === 'formatted' ? formattedValue.value : String(props.value ?? '')
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const downloadValue = async () => {
  let ext = 'txt'
  let content = String(props.value ?? '')

  if (detectedType.value === 'json') ext = 'json'
  else if (detectedType.value === 'xml') ext = 'xml'
  else if (detectedType.value === 'html') ext = 'html'

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.columnName}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    copied.value = false
    isFullscreen.value = false
    viewMode.value = detectedType.value === 'image' ? 'image' : 'formatted'
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('close')">
    <DialogContent
      :class="[
        'p-0 overflow-hidden',
        isFullscreen ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]' : 'max-w-3xl max-h-[80vh]'
      ]"
    >
      <DialogHeader class="px-4 py-3 border-b">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <DialogTitle class="text-sm font-medium">{{ columnName }}</DialogTitle>
            <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {{ columnType || 'unknown' }}
            </span>
            <span class="text-xs text-muted-foreground">{{ valueSize }}</span>
          </div>
          <div class="flex items-center gap-1">
            <!-- View mode toggle -->
            <div v-if="availableViewModes.length > 1" class="flex items-center gap-0.5 mr-2">
              <Button
                v-for="mode in availableViewModes"
                :key="mode.mode"
                :variant="viewMode === mode.mode ? 'default' : 'ghost'"
                size="sm"
                class="h-7 px-2 text-xs"
                @click="viewMode = mode.mode"
              >
                <component :is="mode.icon" class="h-3.5 w-3.5 mr-1" />
                {{ mode.label }}
              </Button>
            </div>

            <Button variant="ghost" size="icon-lg" @click="downloadValue">
              <IconDownload class="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-lg" @click="copyValue">
              <IconCheck v-if="copied" class="h-3.5 w-3.5 text-green-500" />
              <IconCopy v-else class="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-lg" @click="isFullscreen = !isFullscreen">
              <IconMinimize v-if="isFullscreen" class="h-3.5 w-3.5" />
              <IconMaximize v-else class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div
        :class="[
          'overflow-auto',
          isFullscreen ? 'h-[calc(95vh-60px)]' : 'max-h-[calc(80vh-60px)]'
        ]"
      >
        <!-- Image preview -->
        <div v-if="viewMode === 'image' && imageUrl" class="flex items-center justify-center p-4 bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[size:16px_16px]">
          <img
            :src="imageUrl"
            :alt="columnName"
            class="max-w-full max-h-[60vh] object-contain rounded"
          />
        </div>

        <!-- NULL value -->
        <div v-else-if="detectedType === 'null'" class="flex items-center justify-center py-12 text-muted-foreground italic">
          NULL
        </div>

        <!-- Text/Code display -->
        <pre
          v-else
          :class="[
            'p-4 text-sm font-mono whitespace-pre-wrap break-all',
            detectedType === 'json' && viewMode === 'formatted' ? 'text-emerald-600 dark:text-emerald-400' : '',
            detectedType === 'xml' && viewMode === 'formatted' ? 'text-blue-600 dark:text-blue-400' : ''
          ]"
        >{{ formattedValue }}</pre>
      </div>
    </DialogContent>
  </Dialog>
</template>
