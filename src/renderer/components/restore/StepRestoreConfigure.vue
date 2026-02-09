<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { IconFolder, IconRefresh, IconCheck, IconAlertTriangle } from '@tabler/icons-vue'

interface Props {
  connectionId: string
  connectionType: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:config', config: {
    inputPath: string
    binaryPath: string
    isDirectory: boolean
    customArgs: string
    options: Record<string, boolean>
  }): void
}>()

const inputPath = ref('')
const binaryPath = ref('')
const binaryFound = ref(false)
const isDirectory = ref(false)
const customArgs = ref('')
const isDetecting = ref(false)

// DB-specific restore options
const pgOptions = ref({
  'no-owner': false,
  'no-privileges': false,
  clean: false,
  create: false,
  'data-only': false,
  'schema-only': false,
  verbose: false,
  'single-transaction': false,
})

const mysqlOptions = ref({
  'force': false,
})

const activeOptions = computed(() => {
  if (props.connectionType === 'postgresql') return pgOptions.value
  if (props.connectionType === 'mysql' || props.connectionType === 'mariadb') return mysqlOptions.value
  return {}
})

const optionLabels: Record<string, string> = {
  'no-owner': 'Do not restore ownership',
  'no-privileges': 'Do not restore privilege commands',
  clean: 'Drop objects before creating them',
  create: 'Create the database before restoring',
  'data-only': 'Restore only data, not schema',
  'schema-only': 'Restore only schema, not data',
  verbose: 'Verbose mode',
  'single-transaction': 'Restore as a single transaction',
  'force': 'Continue on errors',
}

const hasOptions = computed(() => {
  return props.connectionType === 'postgresql' ||
    props.connectionType === 'mysql' ||
    props.connectionType === 'mariadb'
})

const showDirectoryOption = computed(() => {
  return props.connectionType === 'mongodb'
})

const detectBinary = async () => {
  isDetecting.value = true
  try {
    const result = await window.api.nativeRestore.detectBinary(props.connectionId)
    binaryPath.value = result.path || ''
    binaryFound.value = result.found
  } catch {
    binaryFound.value = false
  } finally {
    isDetecting.value = false
  }
}

const chooseBinary = async () => {
  const result = await window.api.app.showOpenDialog({
    title: 'Select Restore Binary',
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    binaryPath.value = result.filePaths[0]
    binaryFound.value = true
    await window.api.nativeRestore.saveBinaryPath(props.connectionType, binaryPath.value)
  }
}

const chooseInputPath = async () => {
  const properties: ('openFile' | 'openDirectory')[] = isDirectory.value ? ['openDirectory'] : ['openFile']
  const result = await window.api.app.showOpenDialog({
    title: 'Select Backup File to Restore',
    properties,
  })
  if (!result.canceled && result.filePaths.length > 0) {
    inputPath.value = result.filePaths[0]
  }
}

const emitConfig = () => {
  emit('update:config', {
    inputPath: inputPath.value,
    binaryPath: binaryPath.value,
    isDirectory: isDirectory.value,
    customArgs: customArgs.value,
    options: { ...activeOptions.value } as Record<string, boolean>,
  })
}

watch([inputPath, binaryPath, isDirectory, customArgs, pgOptions, mysqlOptions], emitConfig, { deep: true, immediate: true })

onMounted(() => {
  detectBinary()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Input File Path -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Backup File to Restore</Label>
      <div class="flex gap-2">
        <Input v-model="inputPath" placeholder="/path/to/backup.sql" class="flex-1" data-testid="input-path-input" />
        <Button variant="outline" data-testid="choose-input-btn" @click="chooseInputPath">
          <IconFolder class="h-4 w-4 mr-1" />
          Choose
        </Button>
      </div>
    </div>

    <!-- Is Directory (MongoDB) -->
    <div v-if="showDirectoryOption" class="flex flex-col gap-1.5">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="isDirectory" class="rounded border-border" data-testid="is-directory-checkbox" />
        Input is a directory (mongodump output)
      </label>
    </div>

    <!-- Binary Location -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Binary Location</Label>
      <div class="flex gap-2">
        <Input v-model="binaryPath" placeholder="Auto-detected..." class="flex-1" data-testid="binary-path-input" />
        <Button variant="outline" data-testid="choose-binary-btn" @click="chooseBinary">
          <IconFolder class="h-4 w-4 mr-1" />
          Choose
        </Button>
        <Button variant="outline" data-testid="auto-detect-btn" @click="detectBinary" :disabled="isDetecting">
          <IconRefresh class="h-4 w-4 mr-1" :class="{ 'animate-spin': isDetecting }" />
          Auto-detect
        </Button>
      </div>
      <div v-if="binaryFound && binaryPath" class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <IconCheck class="h-3.5 w-3.5" />
        Binary found at {{ binaryPath }}
      </div>
      <div v-else-if="!binaryFound && !isDetecting" class="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
        <IconAlertTriangle class="h-3.5 w-3.5" />
        Binary not found. Please select the path manually.
      </div>
    </div>

    <!-- DB-specific options -->
    <div v-if="hasOptions" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Options</Label>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="(value, key) in activeOptions"
          :key="key"
          class="flex items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            :checked="value"
            class="rounded border-border"
            @change="(activeOptions as Record<string, boolean>)[key as string] = ($event.target as HTMLInputElement).checked"
          />
          {{ optionLabels[key as string] || key }}
        </label>
      </div>
    </div>

    <!-- Custom Arguments -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Custom Arguments</Label>
      <Input v-model="customArgs" placeholder="Additional CLI flags..." data-testid="custom-args-input" />
      <p class="text-xs text-muted-foreground">Extra flags appended to the command</p>
    </div>
  </div>
</template>
