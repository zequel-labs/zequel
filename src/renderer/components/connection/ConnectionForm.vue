<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue'
import type { ConnectionConfig, DatabaseType, SavedConnection, SSHConfig } from '@/types/connection'
import { generateId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  IconDatabase,
  IconServer,
  IconKey,
  IconFolderOpen,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconNetwork,
  IconShieldLock
} from '@tabler/icons-vue'
import SSLConfig, { type SSLConfigData } from './SSLConfig.vue'

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

const form = ref<ConnectionConfig & { sslConfig?: SSLConfigData }>({
  id: '',
  name: '',
  type: 'sqlite',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
  filepath: '',
  ssh: { ...defaultSSHConfig },
  sslConfig: { ...defaultSSLConfig }
})

const showSSHSection = ref(false)
const showSSLSection = ref(false)
const isTesting = ref(false)
const testResult = ref<'success' | 'error' | null>(null)
const testError = ref<string | null>(null)

// Initialize form with existing connection
watch(
  () => props.connection,
  (conn) => {
    if (conn) {
      form.value = {
        ...conn,
        password: '',
        ssh: conn.ssh ? { ...conn.ssh, password: '', privateKeyPassphrase: '' } : { ...defaultSSHConfig },
        sslConfig: conn.sslConfig ? { ...defaultSSLConfig, ...conn.sslConfig } : { ...defaultSSLConfig }
      }
      showSSHSection.value = conn.ssh?.enabled || false
      showSSLSection.value = conn.sslConfig?.enabled || false
    } else {
      form.value = {
        id: generateId(),
        name: '',
        type: 'sqlite',
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: '',
        filepath: '',
        ssh: { ...defaultSSHConfig },
        sslConfig: { ...defaultSSLConfig }
      }
      showSSHSection.value = false
      showSSLSection.value = false
    }
    testResult.value = null
    testError.value = null
  },
  { immediate: true }
)

const isSQLite = computed(() => form.value.type === 'sqlite')
const isMongoDB = computed(() => form.value.type === 'mongodb')
const isRedis = computed(() => form.value.type === 'redis')

function handleTypeChange(type: DatabaseType) {
  form.value.type = type
  form.value.port = DEFAULT_PORTS[type]
  if (type === 'redis') {
    form.value.database = '0'
  }
  testResult.value = null
  testError.value = null
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
    form.value.filepath = result.filePaths[0]
    form.value.database = result.filePaths[0].split('/').pop() || ''
    if (!form.value.name) {
      form.value.name = form.value.database.replace(/\.[^/.]+$/, '')
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
      if (form.value.ssh) {
        form.value.ssh.privateKey = content
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
  try {
    // Use toRaw to get plain object from Vue proxy
    const config = JSON.parse(JSON.stringify(toRaw(form.value)))
    const result = await window.api.connections.test(config)
    testResult.value = result.success ? 'success' : 'error'
    testError.value = result.error || null
  } catch (e) {
    testResult.value = 'error'
    testError.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    isTesting.value = false
  }
}

function handleSave() {
  if (!form.value.id) {
    form.value.id = generateId()
  }
  // Use toRaw to get plain object from Vue proxy
  const config = JSON.parse(JSON.stringify(toRaw(form.value)))
  emit('save', config)
}

const isValid = computed(() => {
  if (!form.value.name) return false
  if (isSQLite.value) {
    return !!form.value.filepath
  }
  if (isRedis.value) {
    return !!(form.value.host && form.value.port)
  }
  if (isMongoDB.value) {
    // MongoDB: valid if connection string is provided OR host+port+database
    const hasConnectionString = form.value.database?.startsWith('mongodb://') || form.value.database?.startsWith('mongodb+srv://')
    return hasConnectionString || !!(form.value.host && form.value.port && form.value.database)
  }
  return !!(form.value.host && form.value.port && form.value.database)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Database Type Selection -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Database Type</label>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="type in (['sqlite', 'postgresql', 'mysql', 'mariadb', 'clickhouse', 'mongodb', 'redis'] as DatabaseType[])"
          :key="type"
          :class="[
            'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
            form.type === type
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground/50'
          ]"
          @click="handleTypeChange(type)"
        >
          <IconDatabase
            class="h-8 w-8"
            :class="{
              'text-blue-500': type === 'postgresql',
              'text-orange-500': type === 'mysql',
              'text-teal-500': type === 'mariadb',
              'text-green-500': type === 'sqlite' || type === 'mongodb',
              'text-yellow-500': type === 'clickhouse',
              'text-red-500': type === 'redis'
            }"
          />
          <span class="text-sm font-medium capitalize">{{ type === 'mariadb' ? 'MariaDB' : type === 'clickhouse' ? 'ClickHouse' : type === 'mongodb' ? 'MongoDB' : type === 'redis' ? 'Redis' : type }}</span>
        </button>
      </div>
    </div>

    <!-- Connection Name & Color -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Connection Name</label>
      <div class="flex gap-2">
        <Input
          v-model="form.name"
          placeholder="My Database"
          class="flex-1"
        />
        <div class="relative">
          <input
            type="color"
            :value="form.color || '#6366f1'"
            @input="form.color = ($event.target as HTMLInputElement).value"
            class="w-10 h-10 rounded-md border border-border cursor-pointer p-0.5"
            title="Connection color"
          />
        </div>
      </div>
      <div class="flex gap-1.5 mt-1">
        <button
          v-for="color in ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899']"
          :key="color"
          type="button"
          class="w-5 h-5 rounded-full border-2 transition-all"
          :class="form.color === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'"
          :style="{ backgroundColor: color }"
          @click="form.color = color"
        />
        <button
          type="button"
          class="w-5 h-5 rounded-full border-2 transition-all text-xs flex items-center justify-center"
          :class="!form.color ? 'border-foreground scale-110' : 'border-muted-foreground/30 hover:scale-110'"
          title="No color"
          @click="form.color = undefined"
        >
          <span class="text-muted-foreground">x</span>
        </button>
      </div>
    </div>

    <!-- SQLite File Path -->
    <div v-if="isSQLite" class="space-y-2">
      <label class="text-sm font-medium">Database File</label>
      <div class="flex gap-2">
        <Input
          v-model="form.filepath"
          placeholder="/path/to/database.db"
          class="flex-1"
        />
        <Button variant="outline" @click="handleBrowseFile">
          <IconFolderOpen class="h-4 w-4 mr-2" />
          Browse
        </Button>
      </div>
    </div>

    <!-- Server Connection Fields -->
    <template v-else>
      <!-- MongoDB connection string hint -->
      <div v-if="isMongoDB" class="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        Connect using host/port fields below, or paste a full MongoDB connection string (e.g. <code class="text-xs bg-muted px-1 py-0.5 rounded">mongodb://...</code>) in the Database field.
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Host</label>
          <div class="relative">
            <IconServer class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="form.host"
              placeholder="localhost"
              class="pl-10"
            />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Port</label>
          <Input
            v-model.number="form.port"
            type="number"
            :placeholder="String(DEFAULT_PORTS[form.type])"
          />
        </div>
      </div>

      <div v-if="isRedis" class="space-y-2">
        <label class="text-sm font-medium">Database Number</label>
        <select
          v-model="form.database"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option v-for="n in 16" :key="n - 1" :value="String(n - 1)">
            db{{ n - 1 }}
          </option>
        </select>
      </div>

      <div v-else class="space-y-2">
        <label class="text-sm font-medium">{{ isMongoDB ? 'Database / Connection String' : 'Database' }}</label>
        <Input
          v-model="form.database"
          :placeholder="isMongoDB ? 'mydb or mongodb://user:pass@host:27017/mydb' : 'database_name'"
        />
      </div>

      <div v-if="!isRedis" class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Username</label>
          <Input
            v-model="form.username"
            placeholder="username"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Password</label>
          <div class="relative">
            <IconKey class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="form.password"
              type="password"
              placeholder="********"
              class="pl-10"
            />
          </div>
        </div>
      </div>

      <!-- Redis Auth (password only, optional) -->
      <div v-if="isRedis" class="space-y-2">
        <label class="text-sm font-medium">Password (optional)</label>
        <div class="relative">
          <IconKey class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="form.password"
            type="password"
            placeholder="Redis password (leave empty if none)"
            class="pl-10"
          />
        </div>
      </div>

      <!-- SSH Tunnel Section -->
      <div class="border rounded-lg">
        <button
          type="button"
          class="flex items-center justify-between w-full p-3 text-left"
          @click="showSSHSection = !showSSHSection"
        >
          <div class="flex items-center gap-2">
            <IconNetwork class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">SSH Tunnel</span>
            <span
              v-if="form.ssh?.enabled"
              class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500"
            >
              Enabled
            </span>
          </div>
          <IconChevronDown
            v-if="showSSHSection"
            class="h-4 w-4 text-muted-foreground"
          />
          <IconChevronRight
            v-else
            class="h-4 w-4 text-muted-foreground"
          />
        </button>

        <div v-if="showSSHSection" class="p-3 pt-0 space-y-4 border-t">
          <div class="flex items-center justify-between">
            <Label for="ssh-enabled" class="cursor-pointer">Enable SSH Tunnel</Label>
            <Switch
              id="ssh-enabled"
              :checked="form.ssh?.enabled"
              @update:checked="form.ssh!.enabled = $event"
            />
          </div>

          <template v-if="form.ssh?.enabled">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Host</label>
                <Input
                  v-model="form.ssh.host"
                  placeholder="ssh.example.com"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Port</label>
                <Input
                  v-model.number="form.ssh.port"
                  type="number"
                  placeholder="22"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">SSH Username</label>
              <Input
                v-model="form.ssh.username"
                placeholder="ssh_user"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Authentication Method</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  :class="[
                    'p-2 rounded-lg border text-sm',
                    form.ssh.authMethod === 'password'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50'
                  ]"
                  @click="form.ssh.authMethod = 'password'"
                >
                  Password
                </button>
                <button
                  type="button"
                  :class="[
                    'p-2 rounded-lg border text-sm',
                    form.ssh.authMethod === 'privateKey'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50'
                  ]"
                  @click="form.ssh.authMethod = 'privateKey'"
                >
                  Private Key
                </button>
              </div>
            </div>

            <template v-if="form.ssh.authMethod === 'password'">
              <div class="space-y-2">
                <label class="text-sm font-medium">SSH Password</label>
                <Input
                  v-model="form.ssh.password"
                  type="password"
                  placeholder="********"
                />
              </div>
            </template>

            <template v-else>
              <div class="space-y-2">
                <label class="text-sm font-medium">Private Key</label>
                <div class="flex gap-2">
                  <Textarea
                    v-model="form.ssh.privateKey"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    rows="4"
                    class="flex-1 font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleBrowsePrivateKey"
                >
                  <IconFolderOpen class="h-4 w-4 mr-2" />
                  Load from file
                </Button>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium">Key Passphrase (optional)</label>
                <Input
                  v-model="form.ssh.privateKeyPassphrase"
                  type="password"
                  placeholder="Passphrase if key is encrypted"
                />
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- SSL/TLS Section -->
      <div class="border rounded-lg">
        <button
          type="button"
          class="flex items-center justify-between w-full p-3 text-left"
          @click="showSSLSection = !showSSLSection"
        >
          <div class="flex items-center gap-2">
            <IconShieldLock class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">SSL/TLS</span>
            <span
              v-if="form.sslConfig?.enabled"
              class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500"
            >
              Enabled
            </span>
          </div>
          <IconChevronDown
            v-if="showSSLSection"
            class="h-4 w-4 text-muted-foreground"
          />
          <IconChevronRight
            v-else
            class="h-4 w-4 text-muted-foreground"
          />
        </button>

        <div v-if="showSSLSection" class="p-3 pt-0 border-t">
          <SSLConfig
            v-if="form.sslConfig"
            v-model="form.sslConfig"
          />
        </div>
      </div>
    </template>

    <!-- Test Result -->
    <div
      v-if="testResult"
      :class="[
        'flex flex-col gap-2 p-3 rounded-lg',
        testResult === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
      ]"
    >
      <div class="flex items-center gap-2">
        <IconCircleCheck v-if="testResult === 'success'" class="h-5 w-5" />
        <IconCircleX v-else class="h-5 w-5" />
        <span class="text-sm font-medium">
          {{ testResult === 'success' ? 'Connection successful!' : 'Connection failed' }}
        </span>
      </div>
      <pre v-if="testError" class="text-xs whitespace-pre-wrap font-mono opacity-90">{{ testError }}</pre>
    </div>

    <!-- Actions -->
    <div class="flex justify-between pt-4 border-t">
      <Button
        variant="outline"
        :disabled="!isValid || isTesting"
        @click="handleTest"
      >
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
