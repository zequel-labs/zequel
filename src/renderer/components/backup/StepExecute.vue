<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { IconPlayerPlay, IconPlayerStop, IconCopy, IconCheck, IconFolderOpen, IconLoader2 } from '@tabler/icons-vue'

type OperationMode = 'backup' | 'restore'

interface Props {
  mode: OperationMode
  config: Record<string, unknown>
}

const props = defineProps<Props>()

const displayCommand = ref('')
const isBuilding = ref(false)
const isRunning = ref(false)
const operationId = ref<string | null>(null)
const status = ref<'idle' | 'running' | 'completed' | 'error' | 'cancelled'>('idle')
const stdout = ref('')
const stderr = ref('')
const exitCode = ref<number | undefined>()
const copied = ref(false)
const copyTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const outputLog = ref<HTMLElement | null>(null)

const modeLabel = computed(() => props.mode === 'backup' ? 'Backup' : 'Restore')

const outputPath = computed(() =>
  props.mode === 'backup' ? (props.config.outputPath as string) : undefined
)

const canExecute = computed(() => {
  if (!displayCommand.value || isBuilding.value) return false
  if (props.mode === 'backup') {
    return !!(props.config.outputPath && props.config.binaryPath)
  }
  return !!(props.config.inputPath && props.config.binaryPath)
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'completed': return 'text-green-600 dark:text-green-400 bg-green-500/10'
    case 'error': return 'text-red-600 dark:text-red-400 bg-red-500/10'
    case 'cancelled': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10'
    default: return ''
  }
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'running': return 'Running...'
    case 'completed': return `${modeLabel.value} completed successfully`
    case 'error': return `${modeLabel.value} failed${exitCode.value !== undefined ? ` (exit code ${exitCode.value})` : ''}`
    case 'cancelled': return `${modeLabel.value} cancelled`
    default: return ''
  }
})

const apiNamespace = computed(() =>
  props.mode === 'backup' ? window.api.nativeBackup : window.api.nativeRestore
)

const handleOutput = (progress: { backupId: string; status: string; stdout: string; stderr: string; exitCode?: number }) => {
  if (operationId.value && progress.backupId === operationId.value) {
    stdout.value = progress.stdout
    stderr.value = progress.stderr
    exitCode.value = progress.exitCode

    if (progress.status === 'completed') {
      status.value = 'completed'
      isRunning.value = false
    } else if (progress.status === 'error') {
      status.value = 'error'
      isRunning.value = false
    } else if (progress.status === 'cancelled') {
      status.value = 'cancelled'
      isRunning.value = false
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
    const spec = await apiNamespace.value.buildCommand(props.config as never)
    displayCommand.value = spec.displayCommand
  } catch (e) {
    displayCommand.value = `Error building command: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    isBuilding.value = false
  }
}

const executeOperation = async () => {
  isRunning.value = true
  status.value = 'running'
  stdout.value = ''
  stderr.value = ''
  exitCode.value = undefined

  try {
    const id = await apiNamespace.value.execute(props.config as never)
    operationId.value = id
  } catch (e) {
    status.value = 'error'
    stderr.value = e instanceof Error ? e.message : `Failed to start ${props.mode}`
    isRunning.value = false
  }
}

const cancelOperation = async () => {
  if (operationId.value) {
    await apiNamespace.value.cancel(operationId.value)
  }
}

const copyCommand = async () => {
  await navigator.clipboard.writeText(displayCommand.value)
  copied.value = true
  if (copyTimer.value) clearTimeout(copyTimer.value)
  copyTimer.value = setTimeout(() => { copied.value = false }, 2000)
}

const revealInFinder = () => {
  if (outputPath.value) {
    window.api.app.showItemInFolder(outputPath.value)
  }
}

onMounted(() => {
  apiNamespace.value.removeOutputListener()
  apiNamespace.value.onOutput(handleOutput)
  buildCommand()
})

onUnmounted(() => {
  apiNamespace.value.removeOutputListener()
  if (copyTimer.value) clearTimeout(copyTimer.value)
  // Cancel running operation to avoid orphaned processes
  if (isRunning.value && operationId.value) {
    apiNamespace.value.cancel(operationId.value)
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <!-- Command Preview -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Command Preview</span>
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
    </div>

    <!-- Execute / Cancel -->
    <div class="flex items-center gap-2">
      <Button
        v-if="status === 'idle' || status === 'completed' || status === 'error' || status === 'cancelled'"
        data-testid="execute-btn"
        :disabled="!canExecute"
        @click="executeOperation"
      >
        <IconPlayerPlay class="h-4 w-4 mr-1" />
        Execute {{ modeLabel }}
      </Button>
      <Button
        v-if="isRunning"
        variant="destructive"
        data-testid="cancel-btn"
        @click="cancelOperation"
      >
        <IconPlayerStop class="h-4 w-4 mr-1" />
        Cancel
      </Button>
      <div v-if="isRunning" class="flex items-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 class="h-4 w-4 animate-spin" />
        Running...
      </div>
    </div>

    <!-- Status Banner -->
    <div v-if="status !== 'idle' && status !== 'running'" data-testid="status-banner" class="rounded-md p-3 text-sm" :class="statusColor">
      <div class="flex items-center justify-between">
        <span>{{ statusLabel }}</span>
        <Button
          v-if="status === 'completed' && outputPath"
          variant="ghost"
          size="sm"
          data-testid="reveal-in-finder-btn"
          @click="revealInFinder"
        >
          <IconFolderOpen class="h-3.5 w-3.5 mr-1" />
          Reveal in Finder
        </Button>
      </div>
    </div>

    <!-- Output Log -->
    <div v-if="stdout || stderr" class="flex-1 min-h-0 flex flex-col gap-1.5">
      <span class="text-sm font-medium">Output</span>
      <div ref="outputLog" data-testid="output-log" class="flex-1 min-h-0 overflow-y-auto bg-muted rounded-md p-3 font-mono text-xs border">
        <pre v-if="stdout" class="whitespace-pre-wrap">{{ stdout }}</pre>
        <pre v-if="stderr" class="whitespace-pre-wrap text-amber-600 dark:text-amber-400">{{ stderr }}</pre>
      </div>
    </div>
  </div>
</template>
