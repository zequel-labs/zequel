<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { IconFolder, IconRefresh, IconCheck, IconAlertTriangle } from '@tabler/icons-vue'
import { DatabaseType } from '@/types/connection'

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
    options: Record<string, boolean | string | number>
  }): void
}>()

// Charset / encoding default to full-Unicode so emoji and multibyte text are preserved.
// MySQL's `utf8` is really utf8mb3 and drops 4-byte chars, so utf8mb4 is the safe default.
const mysqlCharset = ref('utf8mb4')
const pgEncoding = ref('UTF8')
// PostgreSQL dump format: 'plain' (readable .sql via psql) or 'custom' (-Fc compressed
// archive restored via pg_restore — smaller and faster).
const pgFormat = ref('plain')
const pgJobs = ref(2)

const outputPath = ref('')
const binaryPath = ref('')
const binaryFound = ref(false)
const binaryVersion = ref<string | null>(null)
const binaryWarning = ref<string | null>(null)
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
  if (props.connectionType === DatabaseType.PostgreSQL) return pgOptions.value
  if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) return mysqlOptions.value
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
  return props.connectionType === DatabaseType.PostgreSQL ||
    props.connectionType === DatabaseType.MySQL ||
    props.connectionType === DatabaseType.MariaDB
})

const detectBinary = async () => {
  isDetecting.value = true
  try {
    const result = await window.api.nativeBackup.detectBinary(props.connectionId)
    binaryPath.value = result.path || ''
    binaryFound.value = result.found
    binaryVersion.value = result.version ?? null
    binaryWarning.value = result.warning ?? null
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
    await window.api.nativeBackup.saveBinaryPath(props.connectionType, binaryPath.value)
    // Re-detect to get version and warnings for the manually selected binary
    await detectBinary()
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
  const options: Record<string, boolean | string | number> = { ...activeOptions.value }
  // Merge the select-based (non-boolean) options for the active dialect.
  if (props.connectionType === DatabaseType.PostgreSQL) {
    options['encoding'] = pgEncoding.value
    options['format'] = pgFormat.value
    if (pgFormat.value === 'directory') options['jobs'] = pgJobs.value
  } else if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) {
    options['charset'] = mysqlCharset.value
  }
  emit('update:config', {
    outputPath: outputPath.value.trim(),
    binaryPath: binaryPath.value.trim(),
    compress: compress.value,
    customArgs: customArgs.value.trim(),
    options,
  })
}

// Emit on every change
watch([outputPath, binaryPath, compress, customArgs, pgOptions, mysqlOptions, mysqlCharset, pgEncoding, pgFormat, pgJobs], emitConfig, { deep: true, immediate: true })

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
        <Button variant="outline" size="lg" data-testid="choose-output-btn" @click="chooseOutputPath">
          <IconFolder class="h-4 w-4" />
          Choose
        </Button>
      </div>
    </div>

    <!-- Binary Location -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Binary Location</Label>
      <div class="flex gap-2">
        <Input v-model="binaryPath" placeholder="Auto-detected..." class="flex-1" data-testid="binary-path-input" />
        <Button variant="outline" size="lg" data-testid="choose-binary-btn" @click="chooseBinary">
          <IconFolder class="h-4 w-4" />
          Choose
        </Button>
        <Button variant="outline" size="lg" data-testid="auto-detect-btn" @click="detectBinary" :disabled="isDetecting">
          <IconRefresh class="h-4 w-4" :class="{ 'animate-spin': isDetecting }" />
          Auto-detect
        </Button>
      </div>
      <div v-if="binaryFound && binaryPath"
        class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <IconCheck class="h-3.5 w-3.5" />
        Binary found at {{ binaryPath }}<span v-if="binaryVersion"> (v{{ binaryVersion }})</span>
      </div>
      <div v-else-if="!binaryFound && !isDetecting"
        class="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
        <IconAlertTriangle class="h-3.5 w-3.5" />
        Binary not found. Please select the path manually.
      </div>
      <div v-if="binaryWarning"
        class="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <IconAlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{{ binaryWarning }}</span>
      </div>
    </div>

    <!-- Compress -->
    <div class="flex flex-col gap-1.5">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="compress" class="rounded border-border" data-testid="compress-checkbox" />
        Compress output (.zip)
      </label>
    </div>

    <!-- PostgreSQL dump format -->
    <div v-if="connectionType === DatabaseType.PostgreSQL" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Format</Label>
      <select
        v-model="pgFormat"
        data-testid="pg-format-select"
        class="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="plain">Plain SQL (.sql — readable, restored with psql)</option>
        <option value="custom">Custom (-Fc — compressed archive, restored with pg_restore)</option>
        <option value="directory">Directory (-Fd — parallel dump/restore for large DBs)</option>
      </select>
      <div v-if="pgFormat === 'directory'" class="flex items-center gap-2">
        <Label class="text-xs text-muted-foreground">Parallel jobs</Label>
        <Input
          v-model.number="pgJobs"
          type="number"
          min="1"
          max="16"
          data-testid="pg-jobs-input"
          class="w-20"
        />
      </div>
    </div>

    <!-- Encoding / character set (defaults to full Unicode so emoji export correctly) -->
    <div v-if="connectionType === DatabaseType.PostgreSQL" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Encoding</Label>
      <select
        v-model="pgEncoding"
        data-testid="pg-encoding-select"
        class="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="UTF8">UTF8 (recommended)</option>
        <option value="LATIN1">LATIN1</option>
        <option value="SQL_ASCII">SQL_ASCII</option>
      </select>
    </div>
    <div
      v-else-if="connectionType === DatabaseType.MySQL || connectionType === DatabaseType.MariaDB"
      class="flex flex-col gap-1.5"
    >
      <Label class="text-sm font-medium">Character set</Label>
      <select
        v-model="mysqlCharset"
        data-testid="mysql-charset-select"
        class="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="utf8mb4">utf8mb4 (recommended — full Unicode &amp; emoji)</option>
        <option value="utf8">utf8 (utf8mb3 — drops emoji)</option>
        <option value="latin1">latin1</option>
      </select>
      <p class="text-xs text-muted-foreground">
        utf8mb4 preserves emoji and 4-byte characters; MySQL's “utf8” silently drops them.
      </p>
    </div>

    <!-- DB-specific options -->
    <div v-if="hasOptions" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Options</Label>
      <div class="grid grid-cols-2 gap-2">
        <label v-for="(value, key) in activeOptions" :key="key" :data-testid="`backup-option-${key}`" class="flex items-center gap-2 text-sm">
          <input type="checkbox" :checked="value" class="rounded border-border"
            @change="(activeOptions as Record<string, boolean>)[key as string] = ($event.target as HTMLInputElement).checked" />
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
