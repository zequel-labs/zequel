<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import {
  IconPlayerPlay, IconX, IconCopy, IconCheck, IconFolderOpen,
  IconLoader2, IconChevronRight, IconAlertTriangle, IconDatabaseExport,
} from '@tabler/icons-vue'
import { copyToClipboard } from '@/lib/utils'

type OperationMode = 'backup' | 'restore'

interface Props {
  mode: OperationMode
  config: Record<string, unknown>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:running', value: boolean): void
}>()

const displayCommand = ref('')
const isBuilding = ref(false)
const isRunning = ref(false)
const operationId = ref<string | null>(null)
const status = ref<'idle' | 'running' | 'completed' | 'error' | 'cancelled'>('idle')
const stdout = ref('')
const stderr = ref('')
const exitCode = ref<number | undefined>()
const copied = ref(false)
const outputLog = ref<HTMLElement | null>(null)
const showDetails = ref(false)

// Elapsed-time tracking (client-side; honest progress signal for the official-tool path
// where the dump binary emits no parseable percentage).
const elapsedMs = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
let startedAt = 0

const modeLabel = computed(() => props.mode === 'backup' ? 'Backup' : 'Restore')

const revealLabel = computed(() => {
  const platform = window.api?.platform
  if (platform === 'win32') return 'Show in Explorer'
  if (platform === 'linux') return 'Show in Files'
  return 'Reveal in Finder'
})

const outputPath = computed(() =>
  props.mode === 'backup' ? (props.config.outputPath as string) : undefined
)

const fileName = computed(() => {
  const p = outputPath.value
  if (!p) return ''
  return p.split(/[\\/]/).pop() || p
})

const elapsedLabel = computed(() => {
  const totalSec = Math.floor(elapsedMs.value / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const canExecute = computed(() => {
  if (!displayCommand.value || isBuilding.value) return false
  if (props.mode === 'backup') {
    return !!(props.config.outputPath && props.config.binaryPath)
  }
  return !!(props.config.inputPath && props.config.binaryPath)
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'running': return `${modeLabel.value === 'Backup' ? 'Backing up' : 'Restoring'}…`
    case 'completed': return `${modeLabel.value} completed successfully`
    case 'error': return `${modeLabel.value} failed${exitCode.value !== undefined ? ` (exit code ${exitCode.value})` : ''}`
    case 'cancelled': return `${modeLabel.value} cancelled`
    default: return ''
  }
})

const apiNamespace = computed(() =>
  props.mode === 'backup' ? window.api.nativeBackup : window.api.nativeRestore
)

const toPlain = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj))

const setRunning = (value: boolean) => {
  isRunning.value = value
  emit('update:running', value)
}

const stopTimer = () => {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

const handleOutput = (progress: { backupId: string; status: string; stdout: string; stderr: string; exitCode?: number }) => {
  if (operationId.value && progress.backupId === operationId.value) {
    stdout.value = progress.stdout
    stderr.value = progress.stderr
    exitCode.value = progress.exitCode

    if (progress.status === 'completed') {
      status.value = 'completed'
      setRunning(false)
      stopTimer()
    } else if (progress.status === 'error') {
      status.value = 'error'
      setRunning(false)
      stopTimer()
      showDetails.value = true // surface the log automatically on failure
    } else if (progress.status === 'cancelled') {
      status.value = 'cancelled'
      setRunning(false)
      stopTimer()
    }

    nextTick(() => {
      if (outputLog.value) {
        outputLog.value.scrollTop = outputLog.value.scrollHeight
      }
    })
  }
}

const buildCommand = async () => {
  isBuilding.value = true
  try {
    const spec = await apiNamespace.value.buildCommand(toPlain(props.config) as never)
    displayCommand.value = spec.displayCommand
  } catch (e) {
    displayCommand.value = `Error building command: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    isBuilding.value = false
  }
}

const executeOperation = async () => {
  setRunning(true)
  status.value = 'running'
  stdout.value = ''
  stderr.value = ''
  exitCode.value = undefined
  elapsedMs.value = 0
  startedAt = Date.now()
  stopTimer()
  elapsedTimer = setInterval(() => { elapsedMs.value = Date.now() - startedAt }, 250)

  try {
    const id = await apiNamespace.value.execute(toPlain(props.config) as never)
    operationId.value = id
  } catch (e) {
    status.value = 'error'
    stderr.value = e instanceof Error ? e.message : `Failed to start ${props.mode}`
    showDetails.value = true
    setRunning(false)
    stopTimer()
  }
}

const cancelOperation = async () => {
  if (operationId.value) {
    await apiNamespace.value.cancel(operationId.value)
  }
}

const copyCommand = async () => {
  copied.value = await copyToClipboard(displayCommand.value, 'Command copied')
  if (copied.value) {
    setTimeout(() => { copied.value = false }, 2000)
  }
}

const revealInFinder = () => {
  if (outputPath.value) {
    window.api.app.showItemInFolder(outputPath.value)
  }
}

let cleanupOutputListener: (() => void) | null = null

onMounted(() => {
  cleanupOutputListener = apiNamespace.value.onOutput(handleOutput)
  buildCommand()
})

onUnmounted(() => {
  cleanupOutputListener?.()
  stopTimer()
  // Cancel running operation to avoid orphaned processes
  if (isRunning.value && operationId.value) {
    apiNamespace.value.cancel(operationId.value)
  }
})
</script>

<template>
  <div class="flex flex-col gap-5 h-full">
    <!-- Idle: explicit start -->
    <div v-if="status === 'idle'" class="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <IconDatabaseExport class="h-10 w-10 text-muted-foreground" />
      <p class="text-sm text-muted-foreground max-w-sm">
        Ready to start. Progress will appear here while the {{ modeLabel.toLowerCase() }} runs.
      </p>
      <Button data-testid="execute-btn" :disabled="!canExecute" @click="executeOperation">
        <IconPlayerPlay class="h-4 w-4 mr-1" />
        Start {{ modeLabel }}
      </Button>
    </div>

    <!-- Running -->
    <div v-else-if="status === 'running'" class="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <IconLoader2 class="h-10 w-10 animate-spin text-foreground" />
      <div class="space-y-1">
        <p class="text-sm font-medium" data-testid="status-banner">{{ statusLabel }}</p>
        <p class="text-xs text-muted-foreground tabular-nums">Elapsed: {{ elapsedLabel }}</p>
      </div>
      <Button variant="destructive" size="sm" data-testid="cancel-btn" @click="cancelOperation">
        <IconX class="h-4 w-4 mr-1" />
        Cancel
      </Button>
    </div>

    <!-- Completed -->
    <div
      v-else-if="status === 'completed'"
      data-testid="status-banner"
      class="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <div class="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15">
        <IconCheck class="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <p class="text-sm font-medium">{{ statusLabel }}</p>
      <p v-if="fileName" class="text-xs text-muted-foreground break-all max-w-md">
        {{ fileName }} · {{ elapsedLabel }}
      </p>
      <div class="flex items-center gap-2 mt-1">
        <Button
          v-if="outputPath"
          variant="outline"
          size="sm"
          data-testid="reveal-in-finder-btn"
          @click="revealInFinder"
        >
          <IconFolderOpen class="h-3.5 w-3.5 mr-1" />
          {{ revealLabel }}
        </Button>
      </div>
    </div>

    <!-- Error / cancelled -->
    <div
      v-else
      data-testid="status-banner"
      class="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <div
        class="flex items-center justify-center w-12 h-12 rounded-full"
        :class="status === 'error' ? 'bg-red-500/15' : 'bg-yellow-500/15'"
      >
        <IconAlertTriangle
          class="h-6 w-6"
          :class="status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'"
        />
      </div>
      <p class="text-sm font-medium">{{ statusLabel }}</p>
      <Button size="sm" data-testid="retry-btn" :disabled="!canExecute" @click="executeOperation">
        <IconPlayerPlay class="h-4 w-4 mr-1" />
        Try again
      </Button>
    </div>

    <!-- Technical details (command + raw log), collapsed by default -->
    <div class="mt-auto border-t pt-3">
      <button
        type="button"
        class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        data-testid="toggle-details-btn"
        @click="showDetails = !showDetails"
      >
        <IconChevronRight class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-90': showDetails }" />
        Technical details
      </button>

      <div v-if="showDetails" class="mt-2 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">Command</span>
          <Button
            variant="ghost"
            size="sm"
            data-testid="copy-command-btn"
            :disabled="!displayCommand"
            @click="copyCommand"
          >
            <component :is="copied ? IconCheck : IconCopy" class="h-3.5 w-3.5 mr-1" />
            {{ copied ? 'Copied' : 'Copy' }}
          </Button>
        </div>
        <div data-testid="command-preview" class="bg-muted rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all border">
          <template v-if="isBuilding">
            <IconLoader2 class="h-4 w-4 animate-spin inline" /> Building command...
          </template>
          <template v-else>{{ displayCommand }}</template>
        </div>
        <p class="text-xs text-muted-foreground">
          Password is provided via environment variable for security.
        </p>

        <div v-if="stdout || stderr" class="flex flex-col gap-1.5 max-h-64">
          <span class="text-xs font-medium text-muted-foreground">Output</span>
          <div ref="outputLog" data-testid="output-log" class="overflow-y-auto max-h-56 bg-muted rounded-md p-3 font-mono text-xs border">
            <pre v-if="stdout" class="whitespace-pre-wrap">{{ stdout }}</pre>
            <pre v-if="stderr" class="whitespace-pre-wrap text-amber-600 dark:text-amber-400">{{ stderr }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
