<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue'
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import { SSLMode, DatabaseType } from '@/types/connection'
import type { ConnectionConfig, ConnectionEnvironment, SavedConnection, SSHConfig } from '@/types/connection'
import { generateId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, InputError } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  IconFolderOpen,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconClock,
  IconInfoCircle,
  IconX,
  IconChevronRight,
  IconInfoCircleFilled
} from '@tabler/icons-vue'
import type { SSLConfigData } from './SSLConfig.vue'
import DatabaseTypeCombobox from './DatabaseTypeCombobox.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface Props {
  connection?: SavedConnection | null
  prefillPassword?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', config: ConnectionConfig): void
  (e: 'test', config: ConnectionConfig): void
  (e: 'connect', config: ConnectionConfig): void
  (e: 'import-url'): void
}>()

const DEFAULT_PORTS: Record<DatabaseType, number> = {
  [DatabaseType.SQLite]: 0,
  [DatabaseType.MySQL]: 3306,
  [DatabaseType.MariaDB]: 3306,
  [DatabaseType.PostgreSQL]: 5432,
  [DatabaseType.ClickHouse]: 8123,
  [DatabaseType.MongoDB]: 27017,
  [DatabaseType.Redis]: 6379
}

const defaultSSHConfig: SSHConfig = {
  enabled: false,
  host: '',
  port: 22,
  username: '',
  authMethod: 'password',
  password: '',
  privateKey: '',
  privateKeyPassphrase: ''
}

const defaultSSLConfig: SSLConfigData = {
  enabled: true,
  mode: SSLMode.Prefer,
  ca: '',
  cert: '',
  key: '',
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
  serverName: ''
}

const ENVIRONMENTS: { value: ConnectionEnvironment; label: string }[] = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
  { value: 'testing', label: 'Testing' },
  { value: 'local', label: 'Local' }
]

const COLOR_PALETTE = [
  '#6b7280', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#d946ef'
]

const SSL_MODES = [
  { value: SSLMode.Prefer, label: 'PREFERRED' },
  { value: SSLMode.Require, label: 'REQUIRED' },
  { value: SSLMode.VerifyCA, label: 'VERIFY-CA' },
  { value: SSLMode.VerifyFull, label: 'VERIFY-FULL' }
]

const validationSchema = yup.object({
  id: yup.string().default(''),
  type: yup.string<DatabaseType>()
    .required('Database type is required')
    .oneOf(Object.values(DatabaseType), 'Invalid database type'),
  name: yup.string().optional(),
  filepath: yup.string().when('type', {
    is: DatabaseType.SQLite,
    then: (schema) => schema.required('Database file path is required'),
    otherwise: (schema) => schema.optional()
  }),
  database: yup.string().when('type', {
    is: DatabaseType.MongoDB,
    then: (schema) => schema
      .required('Connection string is required')
      .test('mongodb-uri', 'Must start with mongodb:// or mongodb+srv://', (value) =>
        !!value && (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'))
      ),
    otherwise: (schema) => schema.optional()
  }),
  host: yup.string().when('type', {
    is: (type: string) => type !== DatabaseType.SQLite && type !== DatabaseType.MongoDB,
    then: (schema) => schema.required('Host is required'),
    otherwise: (schema) => schema.optional()
  }),
  port: yup.number().when('type', {
    is: (type: string) => type !== DatabaseType.SQLite && type !== DatabaseType.MongoDB,
    then: (schema) => schema
      .required('Port is required')
      .positive('Port must be positive')
      .integer('Port must be an integer')
      .max(65535, 'Port must be 65535 or less'),
    otherwise: (schema) => schema.optional()
  }),
  username: yup.string().when('type', {
    is: (type: string) => type !== DatabaseType.SQLite && type !== DatabaseType.MongoDB && type !== DatabaseType.Redis,
    then: (schema) => schema.required('Username is required'),
    otherwise: (schema) => schema.optional()
  }),
  password: yup.string().optional(),
  color: yup.string().optional(),
  environment: yup.string<ConnectionEnvironment>().optional(),
  ssh: yup.mixed<SSHConfig>(),
  sslConfig: yup.mixed<SSLConfigData>()
})

const initialValues = {
  id: '',
  name: '',
  type: '' as DatabaseType,
  host: '127.0.0.1',
  port: 5432,
  database: '',
  username: '',
  password: '',
  filepath: '',
  color: '#6b7280',
  environment: 'local' as ConnectionEnvironment | undefined,
  ssh: { ...defaultSSHConfig } as SSHConfig,
  sslConfig: { ...defaultSSLConfig } as SSLConfigData
}

const { meta, values, resetForm, setFieldValue, validate } = useForm({
  validationSchema,
  initialValues
})

const { value: typeValue, errorMessage: typeError } = useField<DatabaseType>('type')
const { value: nameValue, errorMessage: nameError } = useField<string>('name')
const { value: filepathValue, errorMessage: filepathError } = useField<string>('filepath')
const { value: databaseValue, errorMessage: databaseError } = useField<string>('database')
const { value: hostValue, errorMessage: hostError } = useField<string>('host')
const { value: portValue, errorMessage: portError } = useField<number>('port')
const { value: usernameValue, errorMessage: usernameError } = useField<string>('username')
const { value: passwordValue } = useField<string>('password')
const { value: colorValue } = useField<string>('color')
const { value: environmentValue } = useField<ConnectionEnvironment | undefined>('environment')
const { value: sshValue } = useField<SSHConfig>('ssh')
const { value: sslConfigValue } = useField<SSLConfigData>('sslConfig')

const sshEnabled = ref(false)
const sslEnabled = ref(false)
const sslExpanded = ref(false)
const sshExpanded = ref(false)

const isTesting = ref(false)
const testResult = ref<'success' | 'error' | null>(null)
const testError = ref<string | null>(null)
const testLatency = ref<number | undefined>(undefined)
const testServerVersion = ref<string | undefined>(undefined)
const testServerInfo = ref<Record<string, string> | undefined>(undefined)
const testSSHSuccess = ref<boolean | undefined>(undefined)
const testSSHError = ref<string | null>(null)

// Initialize form with existing connection
watch(
  () => props.connection,
  (conn) => {
    if (conn) {
      // For MongoDB connections saved with individual fields, reconstruct the URI
      let database = conn.database ?? ''
      if (conn.type === DatabaseType.MongoDB && database && !database.startsWith('mongodb://') && !database.startsWith('mongodb+srv://')) {
        const host = conn.host
        const port = conn.port
        database = `mongodb://${host}:${port}/${database}`
      }

      resetForm({
        values: {
          ...initialValues,
          ...conn,
          password: props.prefillPassword || '',
          ssh: conn.ssh ? { ...conn.ssh, password: '', privateKeyPassphrase: '' } : { ...defaultSSHConfig },
          sslConfig: conn.sslConfig ? { ...defaultSSLConfig, ...conn.sslConfig } : { ...defaultSSLConfig },
          color: conn.color || '#6b7280',
          environment: conn.environment ?? undefined,
          host: conn.host ?? '127.0.0.1',
          port: conn.port ?? 5432,
          database,
          username: conn.username ?? '',
          filepath: conn.filepath ?? ''
        }
      })
      sshEnabled.value = conn.ssh?.enabled || false
      sslEnabled.value = conn.sslConfig?.enabled || false
    } else {
      resetForm({ values: { ...initialValues, id: generateId() } })
      sshEnabled.value = false
      sslEnabled.value = true
    }
    testResult.value = null
    testError.value = null
    testLatency.value = undefined
    testServerVersion.value = undefined
    testServerInfo.value = undefined
    testSSHSuccess.value = undefined
    testSSHError.value = null
  },
  { immediate: true }
)

const isSQLite = computed(() => typeValue.value === DatabaseType.SQLite)
const isMongoDB = computed(() => typeValue.value === DatabaseType.MongoDB)
const isRedis = computed(() => typeValue.value === DatabaseType.Redis)
const isServerBased = computed(() => typeValue.value && !isSQLite.value && !isMongoDB.value)
const useSSHKey = computed(() => sshValue.value?.authMethod === 'privateKey')

const handleSSHToggle = (enabled: boolean) => {
  sshEnabled.value = enabled
  setFieldValue('ssh', { ...sshValue.value!, enabled })
  if (enabled) {
    sshExpanded.value = true
  }
}

const handleSSLToggle = (enabled: boolean) => {
  sslEnabled.value = enabled
  const mode = enabled ? SSLMode.Require : SSLMode.Disable
  setFieldValue('sslConfig', { ...sslConfigValue.value!, enabled, mode })
  if (enabled) {
    sslExpanded.value = true
  }
}

const handleTypeChange = (type: DatabaseType) => {
  setFieldValue('type', type)
  setFieldValue('port', DEFAULT_PORTS[type])
  if (type === DatabaseType.Redis) {
    setFieldValue('database', '')
  }
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined
}

const handleBrowseFile = async () => {
  const result = await window.api.app.showOpenDialog({
    title: 'Select SQLite Database',
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    setFieldValue('filepath', result.filePaths[0])
    setFieldValue('database', result.filePaths[0].split('/').pop() || '')
    if (!nameValue.value) {
      const dbName = result.filePaths[0].split('/').pop() || ''
      setFieldValue('name', dbName.replace(/\.[^/.]+$/, ''))
    }
  }
}

const handleBrowsePrivateKey = async () => {
  const result = await window.api.app.showOpenDialog({
    title: 'Select SSH Private Key',
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = await window.api.app.readFile(result.filePaths[0])
      if (sshValue.value) {
        setFieldValue('ssh', { ...sshValue.value, privateKey: content })
      }
    } catch (e) {
      console.error('Failed to read private key:', e)
    }
  }
}

const clearPrivateKey = () => {
  if (sshValue.value) {
    setFieldValue('ssh', { ...sshValue.value, privateKey: '' })
  }
}

const handleLoadSSLFile = async (field: 'ca' | 'cert' | 'key') => {
  const titles: Record<string, string> = {
    ca: 'Select CA Certificate',
    cert: 'Select Client Certificate',
    key: 'Select Client Private Key'
  }
  const filters = field === 'key'
    ? [{ name: 'Key Files', extensions: ['pem', 'key'] }, { name: 'All Files', extensions: ['*'] }]
    : [{ name: 'Certificate Files', extensions: ['pem', 'crt', 'cer', 'ca-bundle'] }, { name: 'All Files', extensions: ['*'] }]

  const result = await window.api.app.showOpenDialog({
    title: titles[field],
    filters,
    properties: ['openFile'] as const
  })

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = await window.api.app.readFile(result.filePaths[0])
      if (sslConfigValue.value) {
        setFieldValue('sslConfig', { ...sslConfigValue.value, [field]: content })
      }
    } catch (e) {
      console.error(`Failed to read ${field}:`, e)
    }
  }
}

const clearSSLFile = (field: 'ca' | 'cert' | 'key') => {
  if (sslConfigValue.value) {
    setFieldValue('sslConfig', { ...sslConfigValue.value, [field]: '' })
  }
}

const handleTest = async () => {
  const { valid } = await validate()
  if (!valid) return

  isTesting.value = true
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined
  testSSHSuccess.value = undefined
  testSSHError.value = null
  try {
    const config = JSON.parse(JSON.stringify(toRaw(values)))
    const result = await window.api.connections.test(config)
    testResult.value = result.success ? 'success' : 'error'
    testError.value = result.error || null
    testLatency.value = result.latency
    testServerVersion.value = result.serverVersion
    testServerInfo.value = result.serverInfo
    testSSHSuccess.value = result.sshSuccess
    testSSHError.value = result.sshError || null
  } catch (e) {
    testResult.value = 'error'
    testError.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    isTesting.value = false
  }
}

const handleSave = async () => {
  const { valid } = await validate()
  if (!valid) return

  if (!values.id) {
    setFieldValue('id', generateId())
  }
  const config = JSON.parse(JSON.stringify(toRaw(values)))
  emit('save', config)
}

const handleConnect = async () => {
  const { valid } = await validate()
  if (!valid) return

  if (!values.id) {
    setFieldValue('id', generateId())
  }
  const config = JSON.parse(JSON.stringify(toRaw(values)))
  emit('connect', config)
}

const isValid = computed(() => meta.value.valid)


</script>

<template>
  <Card class="w-full max-w-xl">
    <CardHeader class="flex-row items-center justify-between space-y-0">
      <CardTitle class="text-lg">{{ connection ? 'Edit Connection' : 'New Connection' }}</CardTitle>
      <Button v-if="!connection" variant="ghost" @click="emit('import-url')">
        Import from URL
      </Button>
    </CardHeader>
    <CardContent>
      <div class="text-sm flex flex-col gap-4">
        <!-- Database Type -->
        <div v-if="!connection" class="flex flex-col gap-1">
          <Label>Database Type</Label>
          <DatabaseTypeCombobox :model-value="typeValue || undefined" @update:model-value="handleTypeChange" />
        </div>

        <template v-if="typeValue">
          <!-- SQLite: File path -->
          <template v-if="isSQLite">
            <div class="flex flex-col gap-1">
              <Label>File</Label>
              <div class="flex gap-2">
                <Input v-model="filepathValue" placeholder="/path/to/database.db" class="flex-1" />
                <Button variant="outline" size="lg" @click="handleBrowseFile">
                  <IconFolderOpen />
                  Browse
                </Button>
              </div>
              <InputError :message="filepathError" />
            </div>
          </template>

          <!-- MongoDB: Connection string -->
          <template v-else-if="isMongoDB">
            <div class="flex flex-col gap-1">
              <Label>URI</Label>
              <Input v-model="databaseValue" placeholder="mongodb://user:pass@127.0.0.1:27017/mydb"
                data-testid="connection-uri" />
              <InputError :message="databaseError" />
            </div>
          </template>

          <!-- Server-based connections -->
          <template v-else>
            <!-- Host + Port row -->
            <div class="flex gap-3">
              <div class="flex-1 flex flex-col gap-1">
                <Label>Host</Label>
                <Input v-model="hostValue" placeholder="127.0.0.1" data-testid="connection-host" />
                <InputError :message="hostError" />
              </div>
              <div class="w-24 flex flex-col gap-1">
                <Label>Port</Label>
                <Input v-model.number="portValue" type="number" :placeholder="String(DEFAULT_PORTS[typeValue])"
                  data-testid="connection-port" />
                <InputError :message="portError" />
              </div>
            </div>

            <!-- Username -->
            <div v-if="!isRedis" class="flex flex-col gap-1">
              <Label>Username</Label>
              <Input v-model="usernameValue" placeholder="username" data-testid="connection-username" />
              <InputError :message="usernameError" />
            </div>

            <!-- Password -->
            <div class="flex flex-col gap-1">
              <Label>Password</Label>
              <Input v-model="passwordValue" type="password" :placeholder="isRedis ? 'optional' : '********'"
                data-testid="connection-password" />
            </div>

            <!-- Database -->
            <div v-if="!isRedis" class="flex flex-col gap-1">
              <Label>Database</Label>
              <Input v-model="databaseValue" placeholder="database_name" data-testid="connection-database" />
              <span class="text-[10px] text-muted-foreground block">Optional — leave empty to browse databases after
                connecting</span>
            </div>

            <!-- Divider before SSL/SSH -->
            <div class="border-t" />

            <!-- SSL collapsible section -->
            <Collapsible v-model:open="sslExpanded" class="rounded-lg border bg-muted/30">
              <CollapsibleTrigger class="flex items-center w-full px-3 py-2.5 text-left cursor-pointer">
                <IconChevronRight
                  class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150 mr-2"
                  :class="{ 'rotate-90': sslExpanded }" />
                <span class="text-sm font-medium flex-1">Enable SSL</span>
                <Switch :model-value="sslEnabled" @update:model-value="handleSSLToggle" @click.stop
                  data-testid="connection-ssl-switch" />
              </CollapsibleTrigger>

              <CollapsibleContent class="px-3 pb-3 flex flex-col gap-3">
                <div class="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 text-muted-foreground">
                  <IconInfoCircleFilled class="h-4 w-4 shrink-0 mt-0.5" />
                  <p class="text-xs">Providing certificate files is optional. By default, the server certificate will be
                    trusted.</p>
                </div>

                <!-- SSL Mode + Cert buttons row -->
                <div class="flex items-center gap-2">
                  <Select :model-value="sslConfigValue?.mode ?? SSLMode.Prefer"
                    @update:model-value="setFieldValue('sslConfig', { ...sslConfigValue!, mode: $event as SSLMode })">
                    <SelectTrigger class="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="mode in SSL_MODES" :key="mode.value" :value="mode.value">
                        {{ mode.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" class="flex-1" @click="handleLoadSSLFile('ca')">
                    CA{{ sslConfigValue?.ca ? ' ✓' : '' }}
                  </Button>
                  <Button variant="outline" class="flex-1" @click="handleLoadSSLFile('cert')">
                    Cert{{ sslConfigValue?.cert ? ' ✓' : '' }}
                  </Button>
                  <Button variant="outline" class="flex-1" @click="handleLoadSSLFile('key')">
                    Key{{ sslConfigValue?.key ? ' ✓' : '' }}
                  </Button>
                  <button v-if="sslConfigValue?.ca || sslConfigValue?.cert || sslConfigValue?.key" type="button"
                    class="text-muted-foreground hover:text-foreground shrink-0"
                    @click="clearSSLFile('key'); clearSSLFile('cert'); clearSSLFile('ca')">
                    <IconX class="h-3.5 w-3.5" />
                  </button>
                </div>

                <!-- Reject Unauthorized -->
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" :checked="sslConfigValue?.rejectUnauthorized ?? true"
                    class="rounded border-input"
                    @change="setFieldValue('sslConfig', { ...sslConfigValue!, rejectUnauthorized: ($event.target as HTMLInputElement).checked })" />
                  <span class="text-xs">Reject Unauthorized</span>
                </label>
              </CollapsibleContent>
            </Collapsible>

            <!-- SSH collapsible section -->
            <Collapsible v-model:open="sshExpanded" class="rounded-lg border bg-muted/30">
              <CollapsibleTrigger class="flex items-center w-full px-3 py-2.5 text-left cursor-pointer">
                <IconChevronRight
                  class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150 mr-2"
                  :class="{ 'rotate-90': sshExpanded }" />
                <span class="text-sm font-medium flex-1">SSH Tunnel</span>
                <Switch :model-value="sshEnabled" @update:model-value="handleSSHToggle" @click.stop />
              </CollapsibleTrigger>

              <CollapsibleContent class="px-3 pb-3 flex flex-col gap-3">
                <div class="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 text-muted-foreground">
                  <IconInfoCircleFilled class="h-4 w-4 shrink-0 mt-0.5" />
                  <p class="text-xs">Will use ~/.ssh/config if you leave fields empty.</p>
                </div>

                <!-- SSH Server + Port -->
                <div class="flex gap-3">
                  <div class="flex-1 flex flex-col gap-1">
                    <Label>SSH Server</Label>
                    <Input :model-value="sshValue.host"
                      @update:model-value="setFieldValue('ssh', { ...sshValue, host: $event })"
                      placeholder="ssh.example.com" />
                  </div>
                  <div class="w-24 flex flex-col gap-1">
                    <Label>Port</Label>
                    <Input :model-value="sshValue.port"
                      @update:model-value="setFieldValue('ssh', { ...sshValue, port: Number($event) })" type="number"
                      placeholder="22" />
                  </div>
                </div>

                <!-- SSH User -->
                <div class="flex flex-col gap-1">
                  <Label>Username</Label>
                  <Input :model-value="sshValue.username"
                    @update:model-value="setFieldValue('ssh', { ...sshValue, username: $event })"
                    placeholder="ssh_user" />
                </div>

                <!-- SSH Password (when not using key) -->
                <div v-if="!useSSHKey" class="flex flex-col gap-1">
                  <Label>Password</Label>
                  <Input :model-value="sshValue.password"
                    @update:model-value="setFieldValue('ssh', { ...sshValue, password: $event as string })"
                    type="password" placeholder="********" />
                </div>

                <!-- Use SSH key + import button row -->
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" :checked="useSSHKey" class="rounded border-input"
                      @change="setFieldValue('ssh', { ...sshValue, authMethod: ($event.target as HTMLInputElement).checked ? 'privateKey' : 'password' })" />
                    <span class="text-xs">Use SSH key</span>
                  </label>
                  <template v-if="useSSHKey">
                    <Button variant="outline" @click="handleBrowsePrivateKey">
                      {{ sshValue.privateKey ? 'Replace key...' : 'Import key...' }}
                    </Button>
                    <button v-if="sshValue.privateKey" type="button" class="text-muted-foreground hover:text-foreground"
                      @click="clearPrivateKey">
                      <IconX class="h-3.5 w-3.5" />
                    </button>
                    <span v-if="sshValue.privateKey" class="text-xs text-green-600">Loaded</span>
                  </template>
                </div>

                <!-- Passphrase (when using key) -->
                <div v-if="useSSHKey" class="flex flex-col gap-1">
                  <Label>Passphrase</Label>
                  <Input :model-value="sshValue.privateKeyPassphrase"
                    @update:model-value="setFieldValue('ssh', { ...sshValue, privateKeyPassphrase: $event as string })"
                    type="password" placeholder="optional" />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </template>

          <!-- Test Result -->
          <div v-if="testResult" class="flex flex-col gap-1.5 mt-3">
            <!-- SSH step (when SSH was used) -->
            <div v-if="testSSHSuccess !== undefined" :class="[
              'flex items-center gap-2 p-2 rounded-lg',
              testSSHSuccess ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            ]">
              <IconCircleCheck v-if="testSSHSuccess" class="h-4 w-4 shrink-0" />
              <IconCircleX v-else class="h-4 w-4 shrink-0" />
              <span class="text-sm font-medium">
                {{ testSSHSuccess ? 'SSH tunnel connected' : 'SSH tunnel failed' }}
              </span>
            </div>

            <!-- DB step -->
            <div :class="[
              'flex flex-col gap-1.5 p-2.5 rounded-lg',
              testResult === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            ]">
              <div class="flex items-center gap-2">
                <IconCircleCheck v-if="testResult === 'success'" class="h-4 w-4 shrink-0" />
                <IconCircleX v-else class="h-4 w-4 shrink-0" />
                <span class="text-sm font-medium"
                  :data-testid="testResult === 'success' ? 'connection-test-success' : 'connection-test-error'">
                  {{ testResult === 'success' ? 'Database connected' : (testSSHSuccess === false ? 'Database not tested'
                    :
                    'Database connection failed') }}
                </span>
                <Badge v-if="testResult === 'success' && testLatency !== undefined" variant="secondary"
                  class="ml-auto text-green-600 dark:text-green-400 bg-green-500/10 border-0 text-xs">
                  <IconClock class="h-3 w-3 mr-1" />
                  {{ testLatency }}ms
                </Badge>
              </div>
              <pre v-if="testError && testSSHSuccess !== false"
                class="text-xs whitespace-pre-wrap font-mono opacity-90">{{
                  testError }}</pre>
              <pre v-else-if="testSSHError"
                class="text-xs whitespace-pre-wrap font-mono opacity-90">{{ testSSHError }}</pre>

              <!-- Diagnostics -->
              <div
                v-if="testResult === 'success' && (testServerVersion || (testServerInfo && Object.keys(testServerInfo).length > 0))"
                class="mt-1 pt-1.5 border-t border-green-500/20">
                <div class="flex items-center gap-1.5 mb-1.5 text-green-600 dark:text-green-400">
                  <IconInfoCircle class="h-3.5 w-3.5" />
                  <span class="text-xs font-medium">Server Diagnostics</span>
                </div>
                <div class="grid gap-1">
                  <div v-if="testServerVersion" class="flex items-baseline gap-2">
                    <span class="text-xs text-green-600/70 dark:text-green-400/70 min-w-[80px]">Version</span>
                    <span class="text-xs font-mono text-green-700 dark:text-green-300">{{ testServerVersion }}</span>
                  </div>
                  <template v-if="testServerInfo">
                    <div v-for="(value, key) in testServerInfo" :key="key" class="flex items-baseline gap-2">
                      <span class="text-xs text-green-600/70 dark:text-green-400/70 min-w-[80px]">{{ key }}</span>
                      <span class="text-xs font-mono text-green-700 dark:text-green-300">{{ value }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Test + Connect -->
          <template v-if="typeValue">
            <div class="flex justify-end gap-2">
              <Button variant="outline" :disabled="!isValid || isTesting" @click="handleTest"
                data-testid="connection-test-btn">
                <IconLoader2 v-if="isTesting" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Test
              </Button>
              <Button :disabled="!isValid" @click="handleConnect" data-testid="connection-connect-btn">
                Connect
              </Button>
            </div>
          </template>

        </template>
      </div>
    </CardContent>
    <CardFooter v-if="typeValue" class="flex-col gap-3">
      <h3 class="text-sm font-semibold w-full">Save Connection</h3>
      <div class="flex flex-col gap-1 w-full">
        <Input v-model="nameValue" placeholder="Connection Name" />
      </div>
      <div class="flex items-end gap-3 w-full">
        <div class="flex flex-col gap-1">
          <Label>Color</Label>
          <div class="flex flex-wrap gap-1">
            <button v-for="color in COLOR_PALETTE" :key="color" type="button"
              class="size-7 rounded transition-all flex items-center justify-center cursor-pointer"
              :class="colorValue === color ? '' : 'hover:scale-110'" :style="{ backgroundColor: color }"
              @click="colorValue = color">
              <IconX v-if="colorValue === color" class="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <Label>Environment</Label>
          <Select :model-value="environmentValue ?? 'none'"
            @update:model-value="environmentValue = $event === 'none' ? undefined : ($event as ConnectionEnvironment)">
            <SelectTrigger size="lg" class="min-w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">
                {{ env.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div class="flex justify-end w-full">
        <Button variant="default" :disabled="!nameValue" @click="handleSave">
          Save
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>