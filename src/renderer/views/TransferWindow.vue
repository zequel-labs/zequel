<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { IconDatabase, IconDownload, IconUpload, IconLoader2, IconSearch } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/stores/settings'
import OperationProgress from '@/components/backup/OperationProgress.vue'
import RowTransferProgress from '@/components/backup/RowTransferProgress.vue'
import type { RowTransferProgress as RowProgress } from '@main/services/row-transfer'
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
const databaseSearch = ref('')
const databases = ref<string[]>([])
const database = ref('')
let initialDatabase = params.get('database') || ''
const path = ref('')
const format = ref('custom')
const compress = ref(false)
const tool = ref<BackupBinaryInfo | null>(null)
const customBinary = ref('')
const newDatabase = ref('')
const creatingDatabase = ref(false)
const sourceDatabase = ref('')
const noOwner = ref(true)
const singleTransaction = ref(false)
const replaceExisting = ref(false)
const busy = ref(false)
const starting = ref(false)
const error = ref('')
const review = ref<TransferRequest | null>(null)
const reviewPanel = ref<HTMLElement>()
const operations = ref<BackupProgress[]>([])
const rowOperations = ref<RowProgress[]>([])
const selectedOperation = ref('')
const connection = computed(() => connections.value.find(item => item.id === connectionId.value))
const filteredConnections = computed(() => connections.value.filter(item =>
  `${item.name} ${item.folder || ''} ${item.environment || ''}`.toLowerCase().includes(search.value.toLowerCase()),
))
const groups = computed(() => [...new Set(filteredConnections.value.map(item => item.folder || 'Connections'))])
const filteredDatabases = computed(() => databases.value.filter(name => name.toLowerCase().includes(databaseSearch.value.toLowerCase())))
const currentOperation = ref<BackupProgress>()
const ready = computed(() => connection.value && database.value && path.value && !busy.value && (tool.value?.found || customBinary.value) &&
  (mode !== 'restore' || connection.value.type !== 'mongodb' || sourceDatabase.value.trim()))
const canCreateDatabase = computed(() => connection.value && ['postgresql', 'mysql', 'mariadb', 'clickhouse', 'sqlserver', 'mongodb'].includes(connection.value.type))
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

watch(connectionId, async (id) => {
  const version = ++generation
  databases.value = []
  database.value = ''
  databaseSearch.value = ''
  tool.value = null
  customBinary.value = ''
  newDatabase.value = ''
  replaceExisting.value = false
  error.value = ''
  review.value = null
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
watch([database, path, format, compress, customBinary, sourceDatabase, noOwner, singleTransaction, replaceExisting], () => { review.value = null })

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
    error.value = ''
  } catch (cause) { error.value = String(cause) } finally { creatingDatabase.value = false }
}

const chooseDatabaseFile = async (): Promise<void> => {
  const id = connectionId.value
  const result = await window.api.app.showSaveDialog({ title: 'Destination database file', defaultPath: `restored.${connection.value?.type === 'duckdb' ? 'duckdb' : 'sqlite'}` })
  if (connectionId.value !== id || result.canceled || !result.filePath) return
  databases.value = [...new Set([...databases.value, result.filePath])]
  database.value = result.filePath
}

const chooseFile = async (): Promise<void> => {
  const id = connectionId.value
  if (mode === 'backup') {
    const result = await window.api.app.showSaveDialog({
      title: 'Choose backup destination',
      defaultPath: `${database.value || 'backup'}-${new Date().toISOString().replace(/[:.]/g, '-')}.${connection.value?.type === 'redis' ? 'jsonl' : connection.value?.type === 'mongodb' ? 'archive' : connection.value?.type === 'postgresql' && format.value === 'custom' ? 'dump' : 'sql'}`,
    })
    if (connectionId.value === id && !result.canceled && result.filePath) path.value = result.filePath
  } else {
    const result = await window.api.app.showOpenDialog({ title: 'Choose backup file', properties: ['openFile', 'openDirectory'] })
    if (connectionId.value === id && !result.canceled && result.filePaths[0]) path.value = result.filePaths[0]
  }
}

const prepareReview = (): void => {
  if (!ready.value) return
  review.value = {
    mode, savedConnectionId: connectionId.value, database: database.value,
    path: mode === 'backup' && compress.value ? path.value.replace(/\.[^./\\]+$/, '') + '.zip' : path.value, binaryPath: customBinary.value || undefined,
    compress: compress.value,
    options: connection.value?.type === 'postgresql'
      ? { ...(mode === 'backup' ? { format: format.value } : {}), 'no-owner': noOwner.value, 'single-transaction': singleTransaction.value }
      : connection.value?.type === 'mongodb'
        ? { archive: true, sourceDatabase: sourceDatabase.value, drop: replaceExisting.value }
        : { replace: replaceExisting.value },
  }
  void nextTick(() => {
    reviewPanel.value?.focus()
    reviewPanel.value?.scrollIntoView({ block: 'nearest' })
  })
}

const start = async (): Promise<void> => {
  if (!review.value || starting.value) return
  starting.value = true
  error.value = ''
  try {
    selectedOperation.value = await window.api.transfers.start(toPlainObject(review.value))
    review.value = null
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
    <div class="h-10 shrink-0 [-webkit-app-region:drag]" />
    <header class="flex items-center gap-3 border-b px-6 pb-5">
      <div class="rounded-lg border p-2.5">
        <IconDownload v-if="mode === 'backup'" class="size-5" />
        <IconUpload v-else class="size-5" />
      </div>
      <div>
        <h1 class="text-lg font-semibold">{{ title }}</h1>
        <p class="text-sm text-muted-foreground">{{ mode === 'backup' ? 'Choose a database and save a backup.' : 'Choose a backup and its destination database.' }}</p>
      </div>
    </header>
    <div class="grid min-h-0 flex-1 grid-cols-[minmax(160px,220px)_1fr]">
      <aside class="overflow-y-auto border-r bg-muted/20 p-3">
        <label class="relative block">
          <span class="sr-only">Search connections</span>
          <IconSearch class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input v-model="search" class="pl-9" placeholder="Search connections…" />
        </label>
        <div v-for="group in groups" :key="group" class="mt-5">
          <h2 class="mb-1 px-2 text-xs font-medium text-muted-foreground">{{ group }}</h2>
          <button v-for="item in filteredConnections.filter(item => (item.folder || 'Connections') === group)" :key="item.id"
            class="flex w-full items-start gap-2 rounded-md px-2 py-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            :class="{ 'bg-accent': connectionId === item.id }" :aria-pressed="connectionId === item.id" @click="connectionId = item.id">
            <IconDatabase class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0"><span class="block truncate text-sm font-medium">{{ item.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ item.type }} · {{ item.environment || 'No environment' }}</span>
            </span>
          </button>
        </div>
        <p v-if="!filteredConnections.length" class="p-3 text-sm text-muted-foreground">No connections found.</p>
      </aside>
      <main class="min-w-0 overflow-y-auto p-6">
        <div v-if="error" role="alert" class="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</div>
        <div v-if="!connection" class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <IconDatabase class="size-8" /><p>Choose a connection to get started.</p>
        </div>
        <div v-else class="mx-auto max-w-2xl space-y-6">
          <section class="space-y-2">
            <h2 class="text-sm font-medium">{{ mode === 'backup' ? 'Source database' : 'Destination database' }}</h2>
            <Input v-model="databaseSearch" aria-label="Search databases" placeholder="Search databases…" />
            <div v-if="busy" class="flex items-center gap-2 p-4 text-sm text-muted-foreground"><IconLoader2 class="size-4 animate-spin" /> Loading databases…</div>
            <div v-else class="max-h-40 overflow-y-auto rounded-md border" role="group" aria-label="Databases">
              <button v-for="name in filteredDatabases" :key="name" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                :class="{ 'bg-accent font-medium': database === name }" :aria-pressed="database === name" @click="database = name">
                <IconDatabase class="size-4 text-muted-foreground" />{{ name }}
              </button>
              <p v-if="!filteredDatabases.length" class="p-3 text-sm text-muted-foreground">No databases found.</p>
            </div>
            <Button v-if="mode === 'restore' && ['sqlite', 'duckdb'].includes(connection.type)" variant="outline" @click="chooseDatabaseFile">Choose destination database file…</Button>
            <details v-if="mode === 'restore' && canCreateDatabase" class="pt-1">
              <summary class="cursor-pointer text-xs text-muted-foreground">Create a destination database…</summary>
              <p v-if="connection.type === 'mongodb'" class="mt-2 text-xs text-muted-foreground">The database will be created when its first collection is restored.</p>
              <p v-if="connection.type === 'sqlserver'" class="mt-2 text-xs text-muted-foreground">The database and its files will be created on the server when restore starts.</p>
              <div class="mt-2 flex gap-2">
                <Input v-model="newDatabase" aria-label="New database name" placeholder="New database name" />
                <Button variant="outline" :disabled="!newDatabase.trim() || creatingDatabase" @click="createDatabase">Create database</Button>
              </div>
            </details>
          </section>
          <section class="space-y-2">
            <h2 class="text-sm font-medium">{{ mode === 'backup' ? 'Backup destination' : 'Backup file' }}</h2>
            <p v-if="connection.type === 'sqlserver'" class="text-xs text-muted-foreground">Use a path on the database server.</p>
            <Input v-if="connection.type === 'sqlserver'" v-model="path" aria-label="Path on database server" />
            <div v-else class="flex items-center gap-3 rounded-md border p-3">
              <p class="min-w-0 flex-1 break-all text-sm" :class="{ 'text-muted-foreground': !path }">{{ path || 'No file selected' }}</p>
              <Button variant="outline" @click="chooseFile">{{ mode === 'backup' ? 'Choose destination…' : 'Choose file…' }}</Button>
            </div>
          </section>
          <section v-if="mode === 'restore' && connection.type === 'mongodb'" class="space-y-2">
            <label for="source-database" class="text-sm font-medium">Database name inside the backup</label>
            <Input id="source-database" v-model="sourceDatabase" placeholder="Original database name" />
            <p class="text-xs text-muted-foreground">Collections from this database will be restored into the destination selected above.</p>
          </section>
          <section v-if="mode === 'backup' && connection.type === 'postgresql'" class="space-y-2">
            <label for="backup-format" class="block text-sm font-medium">Format</label>
            <select id="backup-format" v-model="format" class="w-full rounded-md border bg-background p-2 text-sm">
              <option value="custom">PostgreSQL archive (.dump)</option><option value="plain">SQL script (.sql)</option>
            </select>
            <p class="text-xs text-muted-foreground">Includes the complete database, rather than a selection of tables.</p>
          </section>
          <details class="rounded-md border p-3">
            <summary class="cursor-pointer text-sm font-medium">Advanced options</summary>
            <div class="mt-3 space-y-3">
              <p class="text-xs text-muted-foreground">{{ tool?.found ? (tool.version ? `Tool version ${tool.version}` : 'Uses a dedicated database connection') : 'Database tools are unavailable.' }}</p>
              <label v-if="!['redis', 'clickhouse'].includes(connection.type)" class="block text-xs">Custom tool path (optional)<Input v-model="customBinary" class="mt-1" placeholder="Use the default tool" /></label>
              <Button v-if="tool?.previousPath && !customBinary" variant="outline" size="sm" @click="customBinary = tool.previousPath!">Use previously configured tool</Button>
              <label v-if="mode === 'backup' && connection.type !== 'sqlserver'" class="flex items-center gap-2 text-sm"><input v-model="compress" type="checkbox" /> Compress as ZIP</label>
              <template v-if="connection.type === 'postgresql'">
                <label v-if="mode === 'restore' || format === 'plain'" class="flex items-center gap-2 text-sm"><input v-model="noOwner" type="checkbox" /> Skip ownership commands{{ mode === 'restore' ? ' (archive format)' : '' }}</label>
                <label v-if="mode === 'restore'" class="flex items-center gap-2 text-sm"><input v-model="singleTransaction" type="checkbox" /> Restore in one transaction</label>
              </template>
              <label v-if="mode === 'restore' && ['redis', 'mongodb', 'sqlserver'].includes(connection.type)" class="flex items-center gap-2 text-sm"><input v-model="replaceExisting" type="checkbox" /> Replace existing {{ connection.type === 'redis' ? 'keys' : connection.type === 'mongodb' ? 'collections' : 'database' }}</label>
            </div>
          </details>
          <section v-if="review" ref="reviewPanel" tabindex="-1" aria-label="Transfer review" class="space-y-3 rounded-md border p-4">
            <h2 class="font-medium">Review {{ mode }}</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="text-muted-foreground">Connection</dt><dd>{{ connection.name }} <span v-if="connection.environment">({{ connection.environment }})</span></dd>
              <dt class="text-muted-foreground">Database</dt><dd>{{ review.database }}</dd>
              <dt class="text-muted-foreground">File</dt><dd class="break-all">{{ review.path }}</dd>
              <template v-if="replaceExisting"><dt class="text-destructive">Existing data</dt><dd>Will be replaced</dd></template>
            </dl>
            <p v-if="mode === 'restore'" class="text-sm text-muted-foreground">The backup can create or change data. Stopping a restore may leave changes already applied.</p>
            <p v-if="mode === 'restore' && ['postgresql', 'mysql', 'mariadb', 'sqlite', 'duckdb', 'clickhouse'].includes(connection.type)" class="text-sm text-muted-foreground">Restoring a SQL script executes its commands. The selected database is the initial connection only: commands in the file can target other databases or files allowed by your account. Review SQL files before running them.</p>
          </section>
        </div>
      </main>
    </div>
    <footer class="flex shrink-0 items-center justify-between gap-4 border-t px-6 py-3">
      <p class="truncate text-xs text-muted-foreground">{{ connection?.name || 'Choose a connection' }}<template v-if="database"> / {{ database }}</template></p>
      <Button v-if="review" :disabled="starting" @click="start"><IconLoader2 v-if="starting" class="mr-2 size-4 animate-spin" />Start {{ mode }}</Button>
      <Button v-else :disabled="!ready || starting" @click="prepareReview">Review {{ mode }}</Button>
    </footer>
    <section v-if="operations.length || rowOperations.length" class="max-h-48 shrink-0 overflow-y-auto border-t bg-muted/20 px-6 py-3">
      <h2 class="mb-2 text-sm font-medium">Operations</h2>
      <div v-for="operation in [...operations].reverse()" :key="operation.backupId" class="py-2">
      <div class="flex items-center gap-3 text-sm">
        <button class="min-w-0 flex-1 truncate text-left hover:underline" @click="selectedOperation = operation.backupId">{{ operation.connectionName }} / {{ operation.database }} · {{ operation.mode }}</button>
        <span :class="operation.status === 'error' ? 'text-destructive' : 'text-muted-foreground'">{{ operation.status }}</span>
        <Button v-if="operation.status === 'completed' && operation.outputLocation === 'local' && operation.outputPath" size="sm" variant="outline" @click="showFile(operation.outputPath)">Show in Folder</Button>
        <Button v-if="operation.status === 'running'" size="sm" variant="outline" @click="cancel(operation.backupId)">Cancel</Button>
      </div>
      <OperationProgress :operation="operation" class="mt-2" />
      </div>
      <div v-for="operation in [...rowOperations].reverse()" :key="operation.id" class="border-t py-2">
        <div class="flex items-center justify-between text-sm"><span>{{ operation.label || 'Row transfer' }}</span><Button v-if="operation.status === 'running'" size="sm" variant="outline" @click="cancelRow(operation.id)">Cancel</Button></div>
        <RowTransferProgress :progress="operation" />
        <p v-if="operation.error" class="text-xs text-destructive">{{ operation.error }}</p>
      </div>
      <pre v-if="currentOperation" class="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-3 text-xs">{{ currentOperation.stdout }}{{ currentOperation.stderr }}</pre>
    </section>
  </div>
</template>
