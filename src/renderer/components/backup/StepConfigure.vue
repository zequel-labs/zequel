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
    outputPath: string
    binaryPath: string
    compress: boolean
    customArgs: string
    options: Record<string, boolean>
  }): void
}>()

const outputPath = ref('')
const binaryPath = ref('')
const binaryFound = ref(false)
const compress = ref(false)
const customArgs = ref('')
const isDetecting = ref(false)

// DB-specific options
const pgOptions = ref({
  inserts: false,
  'no-owner': false,
  'no-privileges': false,
  clean: false,
  create: false,
  'data-only': false,
  'schema-only': false,
  verbose: false,
})

const mysqlOptions = ref({
  'single-transaction': true,
  routines: false,
  triggers: true,
  events: false,
  'add-drop-table': false,
  'no-create-info': false,
  'no-data': false,
})

const activeOptions = computed(() => {
  if (props.connectionType === 'postgresql') return pgOptions.value
  if (props.connectionType === 'mysql' || props.connectionType === 'mariadb') return mysqlOptions.value
  return {}
})

const optionLabels: Record<string, string> = {
  inserts: 'Use INSERT statements (instead of COPY)',
  'no-owner': 'Do not output ownership commands',
  'no-privileges': 'Do not output privilege commands',
  clean: 'Add DROP statements before CREATE',
  create: 'Include CREATE DATABASE command',
  'data-only': 'Dump only data, not schema',
  'schema-only': 'Dump only schema, not data',
  verbose: 'Verbose mode',
  'single-transaction': 'Use single transaction',
  routines: 'Include stored routines',
  triggers: 'Include triggers',
  events: 'Include events',
  'add-drop-table': 'Add DROP TABLE before each CREATE',
  'no-create-info': 'Do not write CREATE TABLE statements',
  'no-data': 'Do not write row data',
}

const hasOptions = computed(() => {
  return props.connectionType === 'postgresql' ||
    props.connectionType === 'mysql' ||
    props.connectionType === 'mariadb'
})

const detectBinary = async () => {
  isDetecting.value = true
  try {
    const result = await window.api.nativeBackup.detectBinary(props.connectionId)
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
    title: 'Select Backup Binary',
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    binaryPath.value = result.filePaths[0]
    binaryFound.value = true
    // Save for future use
    await window.api.nativeBackup.saveBinaryPath(props.connectionType, binaryPath.value)
  }
}

const chooseOutputPath = async () => {
  const result = await window.api.app.showSaveDialog({
    title: 'Backup Output',
    defaultPath: `backup_${new Date().toISOString().split('T')[0]}.sql`,
  })
  if (!result.canceled && result.filePath) {
    outputPath.value = result.filePath
  }
}

const emitConfig = () => {
  emit('update:config', {
    outputPath: outputPath.value,
    binaryPath: binaryPath.value,
    compress: compress.value,
    customArgs: customArgs.value,
    options: { ...activeOptions.value } as Record<string, boolean>,
  })
}

// Emit on every change
watch([outputPath, binaryPath, compress, customArgs, pgOptions, mysqlOptions], emitConfig, { deep: true, immediate: true })

onMounted(() => {
  detectBinary()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Output Path -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Output Path</Label>
      <div class="flex gap-2">
        <Input v-model="outputPath" placeholder="/path/to/backup.sql" class="flex-1" data-testid="output-path-input" />
        <Button variant="outline" data-testid="choose-output-btn" @click="chooseOutputPath">
          <IconFolder class="h-4 w-4 mr-1" />
          Choose
        </Button>
      </div>
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

    <!-- Compress -->
    <div class="flex flex-col gap-1.5">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="compress" class="rounded border-border" data-testid="compress-checkbox" />
        Compress output (.zip)
      </label>
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
