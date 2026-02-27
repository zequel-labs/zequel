<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconFolder, IconRefresh, IconCheck, IconAlertTriangle, IconLoader2 } from '@tabler/icons-vue'
import { DatabaseType } from '@/types/connection'

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
    targetDatabase: string
  }): void
}>()

const inputPath = ref('')
const binaryPath = ref('')
const binaryFound = ref(false)
const binaryVersion = ref<string | null>(null)
const binaryWarning = ref<string | null>(null)
const isDirectory = ref(false)
const customArgs = ref('')
const isDetecting = ref(false)

// Target database
const targetDatabase = ref('')
const databases = ref<{ name: string }[]>([])
const isLoadingDatabases = ref(false)

const needsDatabaseSelect = computed(() => {
  const dbTypes: string[] = [
    DatabaseType.PostgreSQL,
    DatabaseType.MySQL,
    DatabaseType.MariaDB,
    DatabaseType.ClickHouse,
    DatabaseType.MongoDB,
    DatabaseType.SQLServer,
  ]
  return dbTypes.includes(props.connectionType)
})

const loadDatabases = async () => {
  if (!needsDatabaseSelect.value) return
  isLoadingDatabases.value = true
  try {
    const result = await window.api.schema.databases(props.connectionId)
    databases.value = result
    // Pre-select the first database if none is selected
    if (!targetDatabase.value && result.length > 0) {
      targetDatabase.value = result[0].name
    }
  } catch {
    databases.value = []
  } finally {
    isLoadingDatabases.value = false
  }
}

// DB-specific restore options
// psql (used for plain-SQL restore) only supports --single-transaction and --echo-all.
// Options like --no-owner, --clean, --create, etc. are pg_restore flags (custom format only).
const pgOptions = ref({
  'single-transaction': false,
  verbose: false,
})

const mysqlOptions = ref({
  'force': false,
})

const activeOptions = computed(() => {
  if (props.connectionType === DatabaseType.PostgreSQL) return pgOptions.value
  if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) return mysqlOptions.value
  return {}
})

const optionLabels: Record<string, string> = {
  'single-transaction': 'Restore as a single transaction',
  verbose: 'Verbose mode (echo all SQL)',
  'force': 'Continue on errors',
}

const hasOptions = computed(() => {
  return props.connectionType === DatabaseType.PostgreSQL ||
    props.connectionType === DatabaseType.MySQL ||
    props.connectionType === DatabaseType.MariaDB
})

const showDirectoryOption = computed(() => {
  return props.connectionType === DatabaseType.MongoDB
})

const detectBinary = async () => {
  isDetecting.value = true
  try {
    const result = await window.api.nativeRestore.detectBinary(props.connectionId)
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
    title: 'Select Restore Binary',
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    binaryPath.value = result.filePaths[0]
    binaryFound.value = true
    await window.api.nativeRestore.saveBinaryPath(props.connectionType, binaryPath.value)
    // Re-detect to get version and warnings for the manually selected binary
    await detectBinary()
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
    inputPath: inputPath.value.trim(),
    binaryPath: binaryPath.value.trim(),
    isDirectory: isDirectory.value,
    customArgs: customArgs.value.trim(),
    options: { ...activeOptions.value } as Record<string, boolean>,
    targetDatabase: targetDatabase.value,
  })
}

watch([inputPath, binaryPath, isDirectory, customArgs, pgOptions, mysqlOptions, targetDatabase], emitConfig, { deep: true, immediate: true })

onMounted(() => {
  detectBinary()
  loadDatabases()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Input File Path -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Backup File to Restore</Label>
      <div class="flex gap-2">
        <Input v-model="inputPath" placeholder="/path/to/backup.sql" class="flex-1" data-testid="input-path-input" />
        <Button variant="outline" size="lg" data-testid="choose-input-btn" @click="chooseInputPath">
          <IconFolder class="h-4 w-4 mr-1" />
          Choose
        </Button>
      </div>
    </div>

    <!-- Target Database -->
    <div v-if="needsDatabaseSelect" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Target Database</Label>
      <div class="flex gap-2 items-center">
        <Select v-model="targetDatabase" data-testid="target-database-select">
          <SelectTrigger size="lg" class="w-full" data-testid="target-database-trigger">
            <SelectValue placeholder="Select a database..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="db in databases" :key="db.name" :value="db.name">
              {{ db.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon-lg" :disabled="isLoadingDatabases" @click="loadDatabases"
          data-testid="refresh-databases-btn">
          <IconLoader2 v-if="isLoadingDatabases" class="h-4 w-4 animate-spin" />
          <IconRefresh v-else class="h-4 w-4" />
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">Database where the backup will be restored into.</p>
    </div>

    <!-- Is Directory (MongoDB) -->
    <div v-if="showDirectoryOption" class="flex flex-col gap-1.5">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="isDirectory" class="rounded border-border"
          data-testid="is-directory-checkbox" />
        Input is a directory (mongodump output)
      </label>
    </div>

    <!-- Binary Location -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Binary Location</Label>
      <div class="flex gap-2">
        <Input v-model="binaryPath" placeholder="Auto-detected..." class="flex-1" data-testid="binary-path-input" />
        <Button variant="outline" size="lg" data-testid="choose-binary-btn" @click="chooseBinary">
          <IconFolder class="h-4 w-4 mr-1" />
          Choose
        </Button>
        <Button variant="outline" size="lg" data-testid="auto-detect-btn" @click="detectBinary" :disabled="isDetecting">
          <IconRefresh class="h-4 w-4 mr-1" :class="{ 'animate-spin': isDetecting }" />
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

    <!-- DB-specific options -->
    <div v-if="hasOptions" class="flex flex-col gap-1.5">
      <Label class="text-sm font-medium">Options</Label>
      <div class="grid grid-cols-2 gap-2">
        <label v-for="(value, key) in activeOptions" :key="key" :data-testid="`restore-option-${key}`" class="flex items-center gap-2 text-sm">
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