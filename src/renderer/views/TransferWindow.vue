<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { IconChevronDown, IconChevronRight, IconDatabase, IconFolder, IconLoader2, IconSearch, IconX } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import ConnectionAvatar from '@/components/connection/ConnectionAvatar.vue'
import EnvironmentBadge from '@/components/connection/EnvironmentBadge.vue'
import { useSettingsStore } from '@/stores/settings'
import OperationProgress from '@/components/backup/OperationProgress.vue'
import RowTransferProgress from '@/components/backup/RowTransferProgress.vue'
import type { RowTransferProgress as RowProgress } from '@main/services/row-transfer'
import { getConnectionSubtitle, getDatabaseAvatar } from '@/lib/connection'
import { toPlainObject } from '@/lib/utils'
import type { SavedConnection } from '@/types/connection'
import type { BackupBinaryInfo, BackupProgress, TransferRequest } from '@main/types'

useSettingsStore()
const params = new URLSearchParams(window.location.search)
const mode: 'backup' | 'restore' = params.get('operation') === 'restore' ? 'restore' : 'backup'
const title = mode === 'backup' ? 'Backup database' : 'Restore database'
const connections = ref<SavedConnection[]>([])
const connectionId = ref(params.get('connection') || '')
const search = ref('')
const collapsedGroups = ref(new Set<string>())
const databaseSearch = ref('')
const databases = ref<string[]>([])
const database = ref('')
let initialDatabase = params.get('database') || ''
const fileName = ref('')
const fileNameEdited = ref(false)
const serverPath = ref('')
const format = ref('custom')
const compress = ref(false)
const tool = ref<BackupBinaryInfo | null>(null)
const toolChoice = ref<'bundled' | 'previous' | 'custom'>('bundled')
const customBinary = ref('')
const newDatabase = ref('')
const newDatabaseOpen = ref(false)
const creatingDatabase = ref(false)
const sourceDatabase = ref('')
const noOwner = ref(true)
const singleTransaction = ref(false)
const replaceExisting = ref(false)
const busy = ref(false)
const starting = ref(false)
const error = ref('')
const operations = ref<BackupProgress[]>([])
const rowOperations = ref<RowProgress[]>([])
const selectedOperation = ref('')
const currentOperation = ref<BackupProgress>()
const connection = computed(() => connections.value.find(item => item.id === connectionId.value))
const filteredConnections = computed(() => connections.value.filter(item =>
  `${item.name} ${item.folder || ''} ${item.environment || ''}`.toLowerCase().includes(search.value.toLowerCase()),
))
const groups = computed(() => [...new Set(filteredConnections.value.map(item => item.folder || 'Connections'))])
const filteredDatabases = computed(() => databases.value.filter(name => name.toLowerCase().includes(databaseSearch.value.toLowerCase())))
// Column order mirrors TablePlus: options lead on restore and trail on backup.
const panes = mode === 'backup' ? ['connections', 'databases', 'options'] as const : ['options', 'connections', 'databases'] as const
const paneSizes = { connections: 39, databases: 39, options: 22 }
const usesDriver = computed(() => !!connection.value && ['redis', 'clickhouse'].includes(connection.value.type))
const fileDatabase = computed(() => !!connection.value && ['sqlite', 'duckdb'].includes(connection.value.type))
const onServer = computed(() => connection.value?.type === 'sqlserver')
const canCreateDatabase = computed(() => !!connection.value && ['postgresql', 'mysql', 'mariadb', 'clickhouse', 'sqlserver', 'mongodb'].includes(connection.value.type))
const binaryPath = computed(() => toolChoice.value === 'previous' ? tool.value?.previousPath || '' : toolChoice.value === 'custom' ? customBinary.value.trim() : '')
const toolLabel = computed(() => {
  if (usesDriver.value) return 'Built-in client'
  if (!tool.value) return 'Choose version'
  if (!tool.value.found) return 'Tools unavailable'
  const engine = connection.value ? getDatabaseAvatar(connection.value.type).name : ''
  return tool.value.version ? `${engine} ${tool.value.version}` : 'Bundled tools'
})
const extension = computed(() => connection.value?.type === 'redis' ? 'jsonl'
  : connection.value?.type === 'mongodb' ? 'archive'
    : connection.value?.type === 'postgresql' && format.value === 'custom' ? 'dump' : 'sql')
const ready = computed(() => !!connection.value && !!database.value && !busy.value && !starting.value &&
  (tool.value?.found || !!binaryPath.value) &&
  (mode === 'restore' || onServer.value ? true : !!fileName.value.trim()) &&
  (!onServer.value || !!serverPath.value.trim()) &&
  (mode !== 'restore' || connection.value.type !== 'mongodb' || !!sourceDatabase.value.trim()))

// Options appear as command-line style tokens, like TablePlus.
interface OptionToken { id: string; label: string; removable: boolean }
const optionTokens = computed<OptionToken[]>(() => {
  const type = connection.value?.type
  const tokens: OptionToken[] = []
  if (type === 'postgresql') {
    if (mode === 'backup') tokens.push({ id: 'format', label: `--format=${format.value}`, removable: false })
    if (noOwner.value && (mode === 'restore' || format.value === 'plain')) tokens.push({ id: 'no-owner', label: '--no-owner', removable: true })
    if (singleTransaction.value && mode === 'restore') tokens.push({ id: 'single-transaction', label: '--single-transaction', removable: true })
  }
  if (replaceExisting.value && mode === 'restore') tokens.push({ id: 'replace', label: replaceLabel.value, removable: true })
  return tokens
})
const replaceLabel = computed(() => connection.value?.type === 'mongodb' ? '--drop' : connection.value?.type === 'sqlserver' ? 'WITH REPLACE' : 'Replace existing keys')
const availableOptions = computed(() => {
  const type = connection.value?.type
  const items: { id: string; label: string }[] = []
  if (type === 'postgresql') {
    if (mode === 'backup') items.push({ id: format.value === 'custom' ? 'format-plain' : 'format-custom', label: format.value === 'custom' ? '--format=plain (SQL script)' : '--format=custom (archive)' })
    if (!noOwner.value && (mode === 'restore' || format.value === 'plain')) items.push({ id: 'no-owner', label: '--no-owner' })
    if (!singleTransaction.value && mode === 'restore') items.push({ id: 'single-transaction', label: '--single-transaction' })
  }
  if (!replaceExisting.value && mode === 'restore' && type && ['redis', 'mongodb', 'sqlserver'].includes(type)) items.push({ id: 'replace', label: replaceLabel.value })
  return items
})
const addOption = (id: string): void => {
  if (id === 'format-plain') format.value = 'plain'
  else if (id === 'format-custom') format.value = 'custom'
  else if (id === 'no-owner') noOwner.value = true
  else if (id === 'single-transaction') singleTransaction.value = true
  else if (id === 'replace') replaceExisting.value = true
}
const removeOption = (id: string): void => {
  if (id === 'no-owner') noOwner.value = false
  else if (id === 'single-transaction') singleTransaction.value = false
  else if (id === 'replace') replaceExisting.value = false
}

let generation = 0
let timer: ReturnType<typeof setInterval> | undefined
let refreshing = false

const refreshOperations = async (): Promise<void> => {
  if (refreshing) return
  refreshing = true
  try {
    [operations.value, rowOperations.value] = await Promise.all([window.api.transfers.list(), window.api.transfers.rows()])
    if (selectedOperation.value) {
      const selected = selectedOperation.value
      const snapshot = await window.api.transfers.get(selected)
      if (selected === selectedOperation.value) currentOperation.value = snapshot
    }
  } finally { refreshing = false }
}

const toggleGroup = (group: string): void => {
  const next = new Set(collapsedGroups.value)
  if (next.has(group)) next.delete(group)
  else next.add(group)
  collapsedGroups.value = next
}

watch(connectionId, async (id) => {
  const version = ++generation
  databases.value = []
  database.value = ''
  databaseSearch.value = ''
  tool.value = null
  toolChoice.value = 'bundled'
  customBinary.value = ''
  newDatabase.value = ''
  replaceExisting.value = false
  serverPath.value = ''
  error.value = ''
  if (!id) return
  busy.value = true
  try {
    const [items, detectedTool] = await Promise.all([
      window.api.transfers.databases(id),
      window.api.transfers.tool(id, mode),
    ])
    if (version !== generation) return
    databases.value = items.map(item => item.name)
    if (initialDatabase && databases.value.includes(initialDatabase)) database.value = initialDatabase
    initialDatabase = ''
    tool.value = detectedTool
  } catch (cause) {
    if (version === generation) error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (version === generation) busy.value = false
  }
})

// The file name follows the selected database until the user types their own, as in TablePlus.
watch(database, name => {
  if (fileNameEdited.value || !name) return
  fileName.value = (name.split(/[\\/]/).pop() || name).replace(/\.(sqlite3?|db|duckdb)$/i, '')
})

const createDatabase = async (): Promise<void> => {
  if (!newDatabase.value.trim() || creatingDatabase.value) return
  const id = connectionId.value
  const name = newDatabase.value
  creatingDatabase.value = true
  try {
    await window.api.transfers.createDatabase(id, name)
    if (connectionId.value !== id) return
    databases.value = [...databases.value, name].sort()
    database.value = name
    newDatabase.value = ''
    newDatabaseOpen.value = false
    error.value = ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) } finally { creatingDatabase.value = false }
}

const chooseDatabaseFile = async (): Promise<void> => {
  const id = connectionId.value
  const result = await window.api.app.showSaveDialog({ title: 'New database file', defaultPath: `restored.${connection.value?.type === 'duckdb' ? 'duckdb' : 'sqlite'}` })
  if (connectionId.value !== id || result.canceled || !result.filePath) return
  databases.value = [...new Set([...databases.value, result.filePath])]
  database.value = result.filePath
}

// "Start backup…" / "Start restore…" pick the file, then start right away.
const choosePath = async (): Promise<string | undefined> => {
  if (onServer.value) return serverPath.value.trim()
  if (mode === 'backup') {
    const result = await window.api.app.showSaveDialog({
      title: 'Save backup',
      defaultPath: `${fileName.value.trim()}.${compress.value ? 'zip' : extension.value}`,
    })
    if (result.canceled || !result.filePath) return undefined
    return compress.value ? result.filePath.replace(/\.[^./\\]+$/, '') + '.zip' : result.filePath
  }
  const result = await window.api.app.showOpenDialog({ title: 'Choose backup file', properties: ['openFile', 'openDirectory'] })
  return result.canceled ? undefined : result.filePaths[0]
}

const start = async (): Promise<void> => {
  if (!ready.value || !connection.value) return
  const id = connectionId.value
  starting.value = true
  error.value = ''
  try {
    const path = await choosePath()
    if (!path || connectionId.value !== id) return
    const request: TransferRequest = {
      mode, savedConnectionId: id, database: database.value, path, binaryPath: binaryPath.value || undefined,
      compress: compress.value,
      options: connection.value.type === 'postgresql'
        ? { ...(mode === 'backup' ? { format: format.value } : {}), 'no-owner': noOwner.value, 'single-transaction': singleTransaction.value }
        : connection.value.type === 'mongodb'
          ? { archive: true, sourceDatabase: sourceDatabase.value, drop: replaceExisting.value }
          : { replace: replaceExisting.value },
    }
    selectedOperation.value = await window.api.transfers.start(toPlainObject(request))
    await refreshOperations()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally { starting.value = false }
}

const cancelRow = (id: string): void => { void window.api.transfers.cancelRow(id) }
const showFile = (path: string): void => { void window.api.app.showItemInFolder(path) }

const cancel = async (id: string): Promise<void> => {
  await window.api.transfers.cancel(id)
  await refreshOperations()
}

onMounted(async () => {
  try {
    connections.value = await window.api.connections.list()
    const initialId = connectionId.value
    connectionId.value = ''
    await Promise.resolve()
    connectionId.value = initialId
    await refreshOperations()
    timer = setInterval(() => { void refreshOperations().catch(() => {}) }, 500)
  } catch (cause) { error.value = String(cause) }
})
onUnmounted(() => { generation++; if (timer) clearInterval(timer) })
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <header class="flex h-11 shrink-0 items-center justify-center [-webkit-app-region:drag]">
      <h1 class="text-[13px] font-semibold">{{ title }}</h1>
    </header>

    <div v-if="mode === 'backup'" class="flex shrink-0 items-center gap-2 px-4 pb-3">
      <label for="backup-file-name" class="shrink-0 text-[13px]">{{ onServer ? 'Path on server:' : 'File name:' }}</label>
      <Input v-if="onServer" id="backup-file-name" v-model="serverPath" class="h-7 text-[13px]" placeholder="/var/opt/mssql/backup/database.bak" />
      <Input v-else id="backup-file-name" v-model="fileName" class="h-7 text-[13px]" placeholder="untitled" @input="fileNameEdited = true" />
    </div>

    <!-- Resizable columns; widths are remembered per window, like TablePlus -->
    <ResizablePanelGroup direction="horizontal" :auto-save-id="`transfer-${mode}`" class="min-h-0 flex-1 px-4">
      <template v-for="(pane, index) in panes" :key="pane">
      <ResizableHandle v-if="index > 0" class="mx-0.5 w-1.5 rounded-full bg-transparent transition-colors hover:bg-border data-[state=drag]:bg-ring/40" />
      <ResizablePanel :id="pane" :order="index" :default-size="paneSizes[pane]" :min-size="pane === 'options' ? 16 : 20" class="flex min-h-0 flex-col">
      <!-- Connections -->
      <aside v-if="pane === 'connections'" aria-label="Connections" class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div class="p-1.5">
          <label class="relative block">
            <span class="sr-only">Search connections</span>
            <IconSearch class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" class="h-7 rounded-full border-transparent bg-muted pl-8 text-[13px] shadow-none" placeholder="Search for connection…" />
          </label>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          <div v-for="group in groups" :key="group" class="mb-1">
            <button class="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-[13px] font-semibold" :aria-expanded="!collapsedGroups.has(group)" @click="toggleGroup(group)">
              <IconChevronDown v-if="!collapsedGroups.has(group)" class="size-3.5 text-muted-foreground" />
              <IconChevronRight v-else class="size-3.5 text-muted-foreground" />
              <IconFolder class="size-4 text-amber-500" />
              <span class="truncate">{{ group }}</span>
            </button>
            <template v-if="!collapsedGroups.has(group)">
              <button v-for="item in filteredConnections.filter(item => (item.folder || 'Connections') === group)" :key="item.id"
                class="flex w-full items-center gap-2 rounded-md py-1 pl-5 pr-2 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                :class="{ 'bg-accent hover:bg-accent': connectionId === item.id }" :aria-pressed="connectionId === item.id" @click="connectionId = item.id">
                <ConnectionAvatar :type="item.type" />
                <span class="min-w-0 flex-1">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[13px] font-medium">{{ item.name }}</span>
                    <EnvironmentBadge v-if="item.environment" :environment="item.environment" />
                  </span>
                  <span class="block truncate text-[11px] text-muted-foreground">{{ getConnectionSubtitle(item) }}</span>
                </span>
              </button>
            </template>
          </div>
          <p v-if="!filteredConnections.length" class="p-3 text-center text-[13px] text-muted-foreground">No connections found.</p>
        </div>
      </aside>

      <!-- Databases -->
      <section v-else-if="pane === 'databases'" aria-label="Databases" class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div class="p-1.5">
          <label class="relative block">
            <span class="sr-only">Search databases</span>
            <IconSearch class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="databaseSearch" class="h-7 rounded-full border-transparent bg-muted pl-8 text-[13px] shadow-none" placeholder="Search for database…" :disabled="!connection" />
          </label>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5" role="group" aria-label="Database list">
          <p v-if="!connection" class="flex h-full items-center justify-center p-3 text-center text-[13px] text-muted-foreground">Choose a connection to get started.</p>
          <p v-else-if="busy" class="flex items-center justify-center gap-2 p-4 text-[13px] text-muted-foreground"><IconLoader2 class="size-4 animate-spin" /> Loading databases…</p>
          <template v-else>
            <button v-for="name in filteredDatabases" :key="name"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
              :class="{ 'bg-accent hover:bg-accent': database === name }" :aria-pressed="database === name" :aria-label="name" :title="name" @click="database = name">
              <IconDatabase class="size-4 shrink-0 text-sky-500" />
              <span class="truncate">{{ fileDatabase ? name.split(/[\\/]/).pop() : name }}</span>
            </button>
            <p v-if="!filteredDatabases.length" class="p-3 text-center text-[13px] text-muted-foreground">No databases found.</p>
          </template>
        </div>
      </section>

      <!-- Options -->
      <section v-else aria-label="Options" class="flex min-h-0 flex-1 flex-col gap-1.5">
        <Select v-if="!usesDriver && tool?.found !== undefined" v-model="toolChoice" :disabled="!connection">
          <SelectTrigger aria-label="Tool version" class="h-8 w-full text-[13px] data-[size=default]:h-8"><SelectValue :placeholder="toolLabel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bundled">{{ toolLabel }}</SelectItem>
            <SelectItem v-if="tool?.previousPath" value="previous">Previously configured tool</SelectItem>
            <SelectItem value="custom">Custom path…</SelectItem>
          </SelectContent>
        </Select>
        <Button v-else variant="outline" size="sm" class="h-8 w-full justify-between px-2 text-[13px] font-normal" disabled>
          {{ toolLabel }}<IconChevronDown class="size-4 text-muted-foreground" />
        </Button>
        <Input v-if="toolChoice === 'custom'" v-model="customBinary" aria-label="Custom tool path" class="h-7 text-[12px]" placeholder="/path/to/tool" />

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 w-full justify-between px-2 text-[13px] font-normal data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50" :disabled="!availableOptions.length">
              <span :class="{ 'text-muted-foreground': !availableOptions.length }">Add option…</span><IconChevronDown class="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-[--reka-dropdown-menu-trigger-width]">
            <DropdownMenuItem v-for="option in availableOptions" :key="option.id" class="font-mono text-xs" @click="addOption(option.id)">{{ option.label }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <label v-if="mode === 'backup' && connection && !onServer" class="flex items-center gap-2 py-0.5 text-[13px]">
          <Checkbox v-model="compress" />Compress file using ZIP
        </label>

        <Input v-if="mode === 'restore' && connection?.type === 'mongodb'" v-model="sourceDatabase" aria-label="Database name inside the backup" class="h-7 text-[13px]" placeholder="Database in backup" />
        <Input v-if="mode === 'restore' && onServer" v-model="serverPath" aria-label="Backup path on server" class="h-7 text-[13px]" placeholder="Backup path on server" />

        <div class="min-h-24 flex-1 overflow-y-auto rounded-md border bg-card p-1.5" aria-label="Selected options">
          <p v-if="!optionTokens.length" class="px-1 text-[13px] text-muted-foreground">Options…</p>
          <div class="flex flex-wrap gap-1">
            <span v-for="token in optionTokens" :key="token.id" class="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[11px] text-sky-700 dark:text-sky-300">
              {{ token.label }}
              <button v-if="token.removable" :aria-label="`Remove ${token.label}`" class="rounded hover:bg-sky-500/20" @click="removeOption(token.id)"><IconX class="size-3" /></button>
            </span>
          </div>
        </div>
      </section>
      </ResizablePanel>
      </template>
    </ResizablePanelGroup>

    <footer class="flex shrink-0 items-center gap-2 px-4 py-3">
      <p v-if="error" role="alert" class="min-w-0 flex-1 truncate text-[12px] text-destructive" :title="error">{{ error }}</p>
      <p v-else class="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{{ connection ? `${connection.name}${database ? ` / ${database}` : ''}` : '' }}</p>
      <template v-if="mode === 'restore' && connection">
        <Button v-if="fileDatabase" variant="secondary" size="sm" class="h-7 text-[13px]" @click="chooseDatabaseFile">New database…</Button>
        <Popover v-else-if="canCreateDatabase" v-model:open="newDatabaseOpen">
          <PopoverTrigger as-child><Button variant="secondary" size="sm" class="h-7 text-[13px]">New database</Button></PopoverTrigger>
          <PopoverContent align="end" class="w-72 space-y-2 p-3">
            <form class="space-y-2" @submit.prevent="createDatabase">
              <Input v-model="newDatabase" aria-label="New database name" class="h-7 text-[13px]" placeholder="Database name" />
              <p v-if="connection.type === 'mongodb'" class="text-[11px] text-muted-foreground">Created when its first collection is restored.</p>
              <p v-if="connection.type === 'sqlserver'" class="text-[11px] text-muted-foreground">The database and its files are created on the server.</p>
              <Button type="submit" size="sm" class="h-7 w-full text-[13px]" :disabled="!newDatabase.trim() || creatingDatabase">Create database</Button>
            </form>
          </PopoverContent>
        </Popover>
      </template>
      <Button variant="secondary" size="sm" class="h-7 text-[13px]" :disabled="!ready" @click="start">
        <IconLoader2 v-if="starting" class="mr-1.5 size-3.5 animate-spin" />{{ mode === 'backup' ? 'Start backup…' : 'Start restore…' }}
      </Button>
    </footer>

    <section v-if="operations.length || rowOperations.length" aria-label="Operations" class="max-h-48 shrink-0 overflow-y-auto border-t bg-muted/30 px-4 py-2">
      <div v-for="operation in [...operations].reverse()" :key="operation.backupId" class="py-1.5">
        <div class="flex items-center gap-2 text-[13px]">
          <button class="min-w-0 flex-1 truncate text-left hover:underline" @click="selectedOperation = operation.backupId">{{ operation.connectionName }} / {{ operation.database }} · {{ operation.mode }}</button>
          <span class="text-[12px]" :class="operation.status === 'error' ? 'text-destructive' : 'text-muted-foreground'">{{ operation.status }}</span>
          <Button v-if="operation.status === 'completed' && operation.outputLocation === 'local' && operation.outputPath" size="sm" variant="secondary" class="h-6 text-[12px]" @click="showFile(operation.outputPath)">Show in Folder</Button>
          <Button v-if="operation.status === 'running'" size="sm" variant="secondary" class="h-6 text-[12px]" @click="cancel(operation.backupId)">Cancel</Button>
        </div>
        <OperationProgress :operation="operation" class="mt-1" />
      </div>
      <div v-for="operation in [...rowOperations].reverse()" :key="operation.id" class="border-t py-1.5">
        <div class="flex items-center justify-between text-[13px]"><span>{{ operation.label || 'Row transfer' }}</span><Button v-if="operation.status === 'running'" size="sm" variant="secondary" class="h-6 text-[12px]" @click="cancelRow(operation.id)">Cancel</Button></div>
        <RowTransferProgress :progress="operation" />
        <p v-if="operation.error" class="text-[12px] text-destructive">{{ operation.error }}</p>
      </div>
      <pre v-if="currentOperation" class="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-2 text-[11px]">{{ currentOperation.stdout }}{{ currentOperation.stderr }}</pre>
    </section>
  </div>
</template>
