<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  IconShieldCheck,
  IconFolderOpen,
  IconTrash,
  IconFileCheck,
  IconAlertTriangle
} from '@tabler/icons-vue'

export interface SSLConfigData {
  enabled: boolean
  mode: 'require' | 'verify-ca' | 'verify-full' | 'prefer' | 'disable'
  ca?: string
  cert?: string
  key?: string
  rejectUnauthorized: boolean
  minVersion?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'
  serverName?: string // SNI
}

interface Props {
  modelValue: SSLConfigData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SSLConfigData): void
}>()

const config = ref<SSLConfigData>({
  enabled: false,
  mode: 'require',
  ca: '',
  cert: '',
  key: '',
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
  serverName: ''
})

// Initialize from props
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      config.value = { ...newValue }
    }
  },
  { immediate: true }
)

// Emit changes
watch(
  config,
  (newValue) => {
    emit('update:modelValue', { ...newValue })
  },
  { deep: true }
)

const sslModes = [
  { value: 'disable', label: 'Disable', description: 'No SSL connection' },
  { value: 'prefer', label: 'Prefer', description: 'Try SSL, fall back to unencrypted' },
  { value: 'require', label: 'Require', description: 'Always use SSL, no verification' },
  { value: 'verify-ca', label: 'Verify CA', description: 'Verify server certificate is signed by trusted CA' },
  { value: 'verify-full', label: 'Verify Full', description: 'Verify CA and hostname matches' }
]

const tlsVersions = [
  { value: 'TLSv1', label: 'TLS 1.0 (deprecated)' },
  { value: 'TLSv1.1', label: 'TLS 1.1 (deprecated)' },
  { value: 'TLSv1.2', label: 'TLS 1.2' },
  { value: 'TLSv1.3', label: 'TLS 1.3' }
]

const showCertFields = computed(() => {
  return config.value.enabled && ['verify-ca', 'verify-full'].includes(config.value.mode)
})

const showClientCerts = computed(() => {
  return config.value.enabled && config.value.mode !== 'disable'
})

async function handleLoadCACert() {
  const result = await window.api.app.showOpenDialog({
    title: 'Select CA Certificate',
    filters: [
      { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer', 'ca-bundle'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      config.value.ca = await window.api.app.readFile(result.filePaths[0])
    } catch (e) {
      console.error('Failed to read CA certificate:', e)
    }
  }
}

async function handleLoadClientCert() {
  const result = await window.api.app.showOpenDialog({
    title: 'Select Client Certificate',
    filters: [
      { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      config.value.cert = await window.api.app.readFile(result.filePaths[0])
    } catch (e) {
      console.error('Failed to read client certificate:', e)
    }
  }
}

async function handleLoadClientKey() {
  const result = await window.api.app.showOpenDialog({
    title: 'Select Client Private Key',
    filters: [
      { name: 'Key Files', extensions: ['pem', 'key'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      config.value.key = await window.api.app.readFile(result.filePaths[0])
    } catch (e) {
      console.error('Failed to read client key:', e)
    }
  }
}

function clearCACert() {
  config.value.ca = ''
}

function clearClientCert() {
  config.value.cert = ''
}

function clearClientKey() {
  config.value.key = ''
}

function getCertInfo(cert: string): string {
  if (!cert) return ''
  // Basic check for certificate format
  if (cert.includes('-----BEGIN CERTIFICATE-----')) {
    const lines = cert.split('\n')
    return `Certificate loaded (${lines.length} lines)`
  }
  return 'Invalid certificate format'
}

function getKeyInfo(key: string): string {
  if (!key) return ''
  if (key.includes('-----BEGIN') && key.includes('PRIVATE KEY-----')) {
    const lines = key.split('\n')
    const isEncrypted = key.includes('ENCRYPTED')
    return `Private key loaded (${lines.length} lines)${isEncrypted ? ' [encrypted]' : ''}`
  }
  return 'Invalid key format'
}
</script>

<template>
  <div class="space-y-4">
    <!-- SSL Enable Toggle -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <IconShieldCheck class="h-5 w-5 text-muted-foreground" />
        <Label for="ssl-enabled" class="cursor-pointer font-medium">Enable SSL/TLS</Label>
      </div>
      <Switch
        id="ssl-enabled"
        :checked="config.enabled"
        @update:checked="config.enabled = $event"
      />
    </div>

    <template v-if="config.enabled">
      <!-- SSL Mode -->
      <div class="space-y-2">
        <Label>SSL Mode</Label>
        <Select v-model="config.mode">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="mode in sslModes" :key="mode.value" :value="mode.value">
              <div class="flex flex-col">
                <span>{{ mode.label }}</span>
                <span class="text-xs text-muted-foreground">{{ mode.description }}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Reject Unauthorized -->
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label for="reject-unauthorized" class="cursor-pointer">Reject Unauthorized</Label>
          <p class="text-xs text-muted-foreground">
            Reject connections with invalid/self-signed certificates
          </p>
        </div>
        <Switch
          id="reject-unauthorized"
          :checked="config.rejectUnauthorized"
          @update:checked="config.rejectUnauthorized = $event"
        />
      </div>

      <div v-if="!config.rejectUnauthorized" class="flex items-center gap-2 p-2 bg-yellow-500/10 text-yellow-600 rounded-lg text-xs">
        <IconAlertTriangle class="h-4 w-4 flex-shrink-0" />
        <span>Disabling certificate verification reduces security</span>
      </div>

      <!-- Minimum TLS Version -->
      <div class="space-y-2">
        <Label>Minimum TLS Version</Label>
        <Select v-model="config.minVersion">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="ver in tlsVersions" :key="ver.value" :value="ver.value">
              {{ ver.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- CA Certificate -->
      <div v-if="showCertFields" class="space-y-2">
        <Label>CA Certificate</Label>
        <div v-if="config.ca" class="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
          <IconFileCheck class="h-4 w-4 text-green-500" />
          <span class="flex-1 text-sm text-green-600">{{ getCertInfo(config.ca) }}</span>
          <Button variant="ghost" size="icon" class="h-6 w-6" @click="clearCACert">
            <IconTrash class="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <div v-else class="space-y-2">
          <Textarea
            v-model="config.ca"
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            rows="4"
            class="font-mono text-xs"
          />
          <Button variant="outline" size="sm" @click="handleLoadCACert">
            <IconFolderOpen class="h-4 w-4 mr-2" />
            Load from file
          </Button>
        </div>
      </div>

      <!-- Client Certificate (optional) -->
      <div v-if="showClientCerts" class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Client Certificate (optional)</Label>
        </div>
        <div v-if="config.cert" class="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
          <IconFileCheck class="h-4 w-4 text-green-500" />
          <span class="flex-1 text-sm text-green-600">{{ getCertInfo(config.cert) }}</span>
          <Button variant="ghost" size="icon" class="h-6 w-6" @click="clearClientCert">
            <IconTrash class="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <div v-else class="space-y-2">
          <Textarea
            v-model="config.cert"
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            rows="3"
            class="font-mono text-xs"
          />
          <Button variant="outline" size="sm" @click="handleLoadClientCert">
            <IconFolderOpen class="h-4 w-4 mr-2" />
            Load from file
          </Button>
        </div>
      </div>

      <!-- Client Private Key (optional) -->
      <div v-if="showClientCerts" class="space-y-2">
        <Label>Client Private Key (optional)</Label>
        <div v-if="config.key" class="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
          <IconFileCheck class="h-4 w-4 text-green-500" />
          <span class="flex-1 text-sm text-green-600">{{ getKeyInfo(config.key) }}</span>
          <Button variant="ghost" size="icon" class="h-6 w-6" @click="clearClientKey">
            <IconTrash class="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <div v-else class="space-y-2">
          <Textarea
            v-model="config.key"
            placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
            rows="3"
            class="font-mono text-xs"
          />
          <Button variant="outline" size="sm" @click="handleLoadClientKey">
            <IconFolderOpen class="h-4 w-4 mr-2" />
            Load from file
          </Button>
        </div>
      </div>

      <!-- Server Name (SNI) -->
      <div class="space-y-2">
        <Label>Server Name (SNI) - optional</Label>
        <Input
          v-model="config.serverName"
          placeholder="database.example.com"
        />
        <p class="text-xs text-muted-foreground">
          Override the hostname used for TLS server name indication
        </p>
      </div>
    </template>
  </div>
</template>
