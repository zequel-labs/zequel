<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue'
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import type { ConnectionConfig, ConnectionEnvironment, DatabaseType, SavedConnection, SSHConfig } from '@/types/connection'
import { generateId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  IconServer,
  IconKey,
  IconFolderOpen,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconNetwork,
  IconShieldLock,
  IconClock,
  IconInfoCircle
} from '@tabler/icons-vue'
import SSLConfig, { type SSLConfigData } from './SSLConfig.vue'
import DatabaseTypeCombobox from './DatabaseTypeCombobox.vue'

interface Props {
  connection?: SavedConnection | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', config: ConnectionConfig): void
  (e: 'test', config: ConnectionConfig): void
  (e: 'cancel'): void
}>()

const DEFAULT_PORTS: Record<DatabaseType, number> = {
  sqlite: 0,
  mysql: 3306,
  mariadb: 3306,
  postgresql: 5432,
  clickhouse: 8123,
  mongodb: 27017,
  redis: 6379
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
  enabled: false,
  mode: 'require',
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

const validationSchema = yup.object({
  id: yup.string().default(''),
  type: yup.string<DatabaseType>()
    .required('Database type is required')
    .oneOf(['sqlite', 'mysql', 'postgresql', 'mariadb', 'clickhouse', 'mongodb', 'redis'] as const, 'Invalid database type'),
  name: yup.string().required('Connection name is required'),
  filepath: yup.string().when('type', {
    is: 'sqlite',
    then: (schema) => schema.required('Database file path is required'),
    otherwise: (schema) => schema.optional()
  }),
  database: yup.string().when('type', {
    is: 'mongodb',
    then: (schema) => schema
      .required('Connection string is required')
      .test('mongodb-uri', 'Must start with mongodb:// or mongodb+srv://', (value) =>
        !!value && (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'))
      ),
    otherwise: (schema) => schema.optional()
  }),
  host: yup.string().when('type', {
    is: (type: string) => type !== 'sqlite' && type !== 'mongodb',
    then: (schema) => schema.required('Host is required'),
    otherwise: (schema) => schema.optional()
  }),
  port: yup.number().when('type', {
    is: (type: string) => type !== 'sqlite' && type !== 'mongodb',
    then: (schema) => schema
      .required('Port is required')
      .positive('Port must be positive')
      .integer('Port must be an integer')
      .max(65535, 'Port must be 65535 or less'),
    otherwise: (schema) => schema.optional()
  }),
  username: yup.string().optional(),
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
  color: undefined as string | undefined,
  environment: undefined as ConnectionEnvironment | undefined,
  ssh: { ...defaultSSHConfig } as SSHConfig,
  sslConfig: { ...defaultSSLConfig } as SSLConfigData
}

const { meta, values, resetForm, setFieldValue } = useForm({
  validationSchema,
  initialValues
})

const { value: typeValue, errorMessage: typeError } = useField<DatabaseType>('type')
const { value: nameValue, errorMessage: nameError } = useField<string>('name')
const { value: filepathValue, errorMessage: filepathError } = useField<string>('filepath')
const { value: databaseValue, errorMessage: databaseError } = useField<string>('database')
const { value: hostValue, errorMessage: hostError } = useField<string>('host')
const { value: portValue, errorMessage: portError } = useField<number>('port')
const { value: usernameValue } = useField<string>('username')
const { value: passwordValue } = useField<string>('password')
const { value: colorValue } = useField<string | undefined>('color')
const { value: environmentValue } = useField<ConnectionEnvironment | undefined>('environment')
const { value: sshValue } = useField<SSHConfig>('ssh')
const { value: sslConfigValue } = useField<SSLConfigData>('sslConfig')

const showSSHSection = ref(false)
const showSSLSection = ref(false)
const isTesting = ref(false)
const testResult = ref<'success' | 'error' | null>(null)
const testError = ref<string | null>(null)
const testLatency = ref<number | undefined>(undefined)
const testServerVersion = ref<string | undefined>(undefined)
const testServerInfo = ref<Record<string, string> | undefined>(undefined)

// Initialize form with existing connection
watch(
  () => props.connection,
  (conn) => {
    if (conn) {
      // For MongoDB connections saved with individual fields, reconstruct the URI
      let database = conn.database ?? ''
      if (conn.type === 'mongodb' && database && !database.startsWith('mongodb://') && !database.startsWith('mongodb+srv://')) {
        const host = conn.host
        const port = conn.port
        database = `mongodb://${host}:${port}/${database}`
      }

      resetForm({
        values: {
          ...initialValues,
          ...conn,
          password: '',
          ssh: conn.ssh ? { ...conn.ssh, password: '', privateKeyPassphrase: '' } : { ...defaultSSHConfig },
          sslConfig: conn.sslConfig ? { ...defaultSSLConfig, ...conn.sslConfig } : { ...defaultSSLConfig },
          color: conn.color ?? undefined,
          environment: conn.environment ?? undefined,
          host: conn.host ?? '127.0.0.1',
          port: conn.port ?? 5432,
          database,
          username: conn.username ?? '',
          filepath: conn.filepath ?? ''
        }
      })
      showSSHSection.value = conn.ssh?.enabled || false
      showSSLSection.value = conn.sslConfig?.enabled || false
    } else {
      resetForm({ values: { ...initialValues, id: generateId() } })
      showSSHSection.value = false
      showSSLSection.value = false
    }
    testResult.value = null
    testError.value = null
    testLatency.value = undefined
    testServerVersion.value = undefined
    testServerInfo.value = undefined
  },
  { immediate: true }
)

const isSQLite = computed(() => typeValue.value === 'sqlite')
const isMongoDB = computed(() => typeValue.value === 'mongodb')
const isRedis = computed(() => typeValue.value === 'redis')

function handleTypeChange(type: DatabaseType) {
  setFieldValue('type', type)
  setFieldValue('port', DEFAULT_PORTS[type])
  if (type === 'redis') {
    setFieldValue('database', '')
  }
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined
}

async function handleBrowseFile() {
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

async function handleBrowsePrivateKey() {
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

async function handleTest() {
  isTesting.value = true
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined
  try {
    const config = JSON.parse(JSON.stringify(toRaw(values)))
    const result = await window.api.connections.test(config)
    testResult.value = result.success ? 'success' : 'error'
    testError.value = result.error || null
    testLatency.value = result.latency
    testServerVersion.value = result.serverVersion
    testServerInfo.value = result.serverInfo
  } catch (e) {
    testResult.value = 'error'
    testError.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    isTesting.value = false
  }
}

function handleSave() {
  if (!values.id) {
    setFieldValue('id', generateId())
  }
  const config = JSON.parse(JSON.stringify(toRaw(values)))
  emit('save', config)
}

const isValid = computed(() => meta.value.valid)
</script>

<template>
  <div class="space-y-4">
    <!-- Database Type Selection (only on create) -->
    <div v-if="!props.connection" class="space-y-2">
      <label class="text-sm font-medium">Database Type</label>
      <DatabaseTypeCombobox :model-value="typeValue" @update:model-value="handleTypeChange" />
    </div>

    <template v-if="typeValue">
    <!-- Connection Name & Color -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Connection Name</label>
      <Input v-model="nameValue" placeholder="My Database" />
      <span v-if="nameError" class="text-sm text-red-500">{{ nameError }}</span>
      <div class="flex gap-1.5 mt-1">
        <button
          v-for="color in ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']"
          :key="color" type="button" class="w-5 h-5 rounded-full border-2 transition-all"
          :class="colorValue === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'"
          :style="{ backgroundColor: color }" @click="colorValue = color" />
        <button type="button"
          class="w-5 h-5 rounded-full border-2 transition-all text-xs flex items-center justify-center"
          :class="!colorValue ? 'border-foreground scale-110' : 'border-muted-foreground/30 hover:scale-110'"
          title="No color" @click="colorValue = undefined">
          <span class="text-muted-foreground">x</span>
        </button>
      </div>
    </div>

    <!-- Environment -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Environment</label>
      <select v-model="environmentValue"
        class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option :value="undefined">None</option>
        <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">
          {{ env.label }}
        </option>
      </select>
    </div>

    <!-- SQLite File Path -->
    <div v-if="isSQLite" class="space-y-2">
      <label class="text-sm font-medium">Database File</label>
      <div class="flex gap-2">
        <Input v-model="filepathValue" placeholder="/path/to/database.db" class="flex-1" />
        <Button variant="outline" @click="handleBrowseFile">
          <IconFolderOpen class="h-4 w-4 mr-2" />
          Browse
        </Button>
      </div>
      <span v-if="filepathError" class="text-sm text-red-500">{{ filepathError }}</span>
    </div>

    <!-- MongoDB: Connection String only -->
    <template v-else-if="isMongoDB">
      <div class="space-y-2">
        <label class="text-sm font-medium">Connection String</label>
        <Input v-model="databaseValue" placeholder="mongodb://user:pass@127.0.0.1:27017/mydb" />
        <span v-if="databaseError" class="text-sm text-red-500">{{ databaseError }}</span>
      </div>
    </template>

    <!-- Server Connection Fields -->
    <template v-else>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Host</label>
          <div class="relative">
            <IconServer class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="hostValue" placeholder="127.0.0.1" class="pl-10" />
          </div>
          <span v-if="hostError" class="text-sm text-red-500">{{ hostError }}</span>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Port</label>
          <Input v-model.number="portValue" type="number" :placeholder="String(DEFAULT_PORTS[typeValue])" />
          <span v-if="portError" class="text-sm text-red-500">{{ portError }}</span>
        </div>
      </div>

      <div v-if="!isRedis" class="space-y-2">
        <label class="text-sm font-medium">Database</label>
        <Input v-model="databaseValue" placeholder="database_name (optional)" />
        <p class="text-xs text-muted-foreground">
          Leave empty to browse and select a database after connecting.
        </p>
      </div>

      <div v-if="!isRedis" class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Username</label>
          <Input v-model="usernameValue" placeholder="username" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Password</label>
          <div class="relative">
            <IconKey class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="passwordValue" type="password" placeholder="********" class="pl-10" />
          </div>
        </div>
      </div>

      <!-- Redis Auth (password only, optional) -->
      <div v-if="isRedis" class="space-y-2">
        <label class="text-sm font-medium">Password (optional)</label>
        <div class="relative">
          <IconKey class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="passwordValue" type="password" placeholder="Redis password (leave empty if none)"
            class="pl-10" />
        </div>
      </div>

      <!-- SSH Tunnel Section -->
      <div class="border rounded-lg">
        <button type="button" class="flex items-center justify-between w-full p-3 text-left"
          @click="showSSHSection = !showSSHSection">
          <div class="flex items-center gap-2">
            <IconNetwork class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">SSH Tunnel</span>
            <span v-if="sshValue?.enabled" class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
              Enabled
            </span>
          </div>
          <IconChevronDown v-if="showSSHSection" class="h-4 w-4 text-muted-foreground" />
          <IconChevronRight v-else class="h-4 w-4 text-muted-foreground" />
        </button>

        <div v-if="showSSHSection" class="p-3 pt-0 space-y-4 border-t">
          <div class="flex items-center justify-between">
            <Label for="ssh-enabled" class="cursor-pointer">Enable SSH Tunnel</Label>
            <Switch id="ssh-enabled" :checked="sshValue?.enabled" @update:checked="setFieldValue('ssh', { ...sshValue!, enabled: $event })" />
          </div>

          <template v-if="sshValue?.enabled">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Host</label>
                <Input :model-value="sshValue.host" @update:model-value="setFieldValue('ssh', { ...sshValue, host: $event })" placeholder="ssh.example.com" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Port</label>
                <Input :model-value="sshValue.port" @update:model-value="setFieldValue('ssh', { ...sshValue, port: Number($event) })" type="number" placeholder="22" />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">SSH Username</label>
              <Input :model-value="sshValue.username" @update:model-value="setFieldValue('ssh', { ...sshValue, username: $event })" placeholder="ssh_user" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Authentication Method</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" :class="[
                  'p-2 rounded-lg border text-sm',
                  sshValue.authMethod === 'password'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
                ]" @click="setFieldValue('ssh', { ...sshValue, authMethod: 'password' })">
                  Password
                </button>
                <button type="button" :class="[
                  'p-2 rounded-lg border text-sm',
                  sshValue.authMethod === 'privateKey'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
                ]" @click="setFieldValue('ssh', { ...sshValue, authMethod: 'privateKey' })">
                  Private Key
                </button>
              </div>
            </div>

            <template v-if="sshValue.authMethod === 'password'">
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Password</label>
                <Input :model-value="sshValue.password" @update:model-value="setFieldValue('ssh', { ...sshValue, password: $event as string })" type="password" placeholder="********" />
              </div>
            </template>

            <template v-else>
              <div class="space-y-2">
                <label class="text-sm font-medium">Private Key</label>
                <div class="flex gap-2">
                  <Textarea :model-value="sshValue.privateKey" @update:model-value="setFieldValue('ssh', { ...sshValue, privateKey: $event as string })" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows="4"
                    class="flex-1 font-mono text-xs" />
                </div>
                <Button type="button" variant="outline" size="sm" @click="handleBrowsePrivateKey">
                  <IconFolderOpen class="h-4 w-4 mr-2" />
                  Load from file
                </Button>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium">Key Passphrase (optional)</label>
                <Input :model-value="sshValue.privateKeyPassphrase" @update:model-value="setFieldValue('ssh', { ...sshValue, privateKeyPassphrase: $event as string })" type="password"
                  placeholder="Passphrase if key is encrypted" />
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- SSL/TLS Section -->
      <div class="border rounded-lg">
        <button type="button" class="flex items-center justify-between w-full p-3 text-left"
          @click="showSSLSection = !showSSLSection">
          <div class="flex items-center gap-2">
            <IconShieldLock class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">SSL/TLS</span>
            <span v-if="sslConfigValue?.enabled" class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
              Enabled
            </span>
          </div>
          <IconChevronDown v-if="showSSLSection" class="h-4 w-4 text-muted-foreground" />
          <IconChevronRight v-else class="h-4 w-4 text-muted-foreground" />
        </button>

        <div v-if="showSSLSection" class="p-3 pt-0 border-t">
          <SSLConfig v-if="sslConfigValue" v-model="sslConfigValue" />
        </div>
      </div>
    </template>
    </template>

    <!-- Test Result -->
    <div v-if="testResult" :class="[
      'flex flex-col gap-2 p-3 rounded-lg',
      testResult === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
    ]">
      <div class="flex items-center gap-2">
        <IconCircleCheck v-if="testResult === 'success'" class="h-5 w-5 shrink-0" />
        <IconCircleX v-else class="h-5 w-5 shrink-0" />
        <span class="text-sm font-medium">
          {{ testResult === 'success' ? 'Connection successful!' : 'Connection failed' }}
        </span>
        <Badge v-if="testResult === 'success' && testLatency !== undefined" variant="secondary"
          class="ml-auto text-green-600 dark:text-green-400 bg-green-500/10 border-0">
          <IconClock class="h-3 w-3 mr-1" />
          {{ testLatency }}ms
        </Badge>
      </div>
      <pre v-if="testError" class="text-xs whitespace-pre-wrap font-mono opacity-90">{{ testError }}</pre>

      <!-- Diagnostics Panel -->
      <div
        v-if="testResult === 'success' && (testServerVersion || (testServerInfo && Object.keys(testServerInfo).length > 0))"
        class="mt-1 pt-2 border-t border-green-500/20">
        <div class="flex items-center gap-1.5 mb-2 text-green-600 dark:text-green-400">
          <IconInfoCircle class="h-3.5 w-3.5" />
          <span class="text-xs font-medium">Server Diagnostics</span>
        </div>
        <div class="grid gap-1.5">
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

    <!-- Actions -->
    <div class="flex justify-between pt-4 border-t">
      <Button variant="outline" :disabled="!isValid || isTesting" @click="handleTest">
        <IconLoader2 v-if="isTesting" class="h-4 w-4 mr-2 animate-spin" />
        Test Connection
      </Button>

      <div class="flex gap-2">
        <Button variant="outline" @click="emit('cancel')">
          Cancel
        </Button>
        <Button :disabled="!isValid" @click="handleSave">
          {{ connection ? 'Save Changes' : 'Create Connection' }}
        </Button>
      </div>
    </div>
  </div>
</template>
