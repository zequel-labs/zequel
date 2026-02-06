<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ConnectionConfig } from '@/types/connection'
import { DatabaseType } from '@/types/connection'
import { generateId } from '@/lib/utils'
import { parseConnectionUrl } from '@/lib/connection-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconClock,
  IconInfoCircle
} from '@tabler/icons-vue'

import { getDbLogo } from '@/lib/db-logos'

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', config: ConnectionConfig): void
}>()

const urlInput = ref('')
const connectionName = ref('')
const parseError = ref<string | null>(null)
const parsed = ref<ReturnType<typeof parseConnectionUrl> | null>(null)

// Test connection state
const isTesting = ref(false)
const testResult = ref<'success' | 'error' | null>(null)
const testError = ref<string | null>(null)
const testLatency = ref<number | undefined>(undefined)
const testServerVersion = ref<string | undefined>(undefined)
const testServerInfo = ref<Record<string, string> | undefined>(undefined)

const isValid = computed(() => parsed.value !== null && connectionName.value.trim() !== '')

const resetState = () => {
  urlInput.value = ''
  connectionName.value = ''
  parseError.value = null
  parsed.value = null
  isTesting.value = false
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined
}

watch(urlInput, (url) => {
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined

  if (!url.trim()) {
    parsed.value = null
    parseError.value = null
    connectionName.value = ''
    return
  }

  try {
    const result = parseConnectionUrl(url)
    parsed.value = result
    parseError.value = null

    // Auto-generate connection name
    if (result.type === DatabaseType.MongoDB) {
      connectionName.value = `mongodb@${result.host}`
    } else {
      const db = result.database ? `/${result.database}` : ''
      connectionName.value = `${result.type}@${result.host}${db}`
    }
  } catch (e) {
    parsed.value = null
    parseError.value = e instanceof Error ? e.message : 'Invalid URL'
    connectionName.value = ''
  }
})

const buildConfig = (): ConnectionConfig => {
  const p = parsed.value!
  return {
    id: generateId(),
    name: connectionName.value.trim(),
    type: p.type,
    host: p.host,
    port: p.port,
    database: p.database,
    username: p.username || undefined,
    password: p.password || undefined,
  }
}

const handleTest = async () => {
  if (!parsed.value) return

  isTesting.value = true
  testResult.value = null
  testError.value = null
  testLatency.value = undefined
  testServerVersion.value = undefined
  testServerInfo.value = undefined

  try {
    const config = buildConfig()
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

const handleSave = () => {
  if (!isValid.value) return
  emit('save', buildConfig())
}

const handleOpenChange = (open: boolean) => {
  emit('update:open', open)
  if (!open) {
    resetState()
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Import from URL</DialogTitle>
        <DialogDescription>
          Paste a connection URL to quickly create a new connection.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- URL Input -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Connection URL</label>
          <Input
            v-model="urlInput"
            placeholder="postgresql://user:pass@host:5432/mydb"
            class="h-8 text-sm"
          />
          <p v-if="parseError" class="text-sm text-red-500">{{ parseError }}</p>
        </div>

        <!-- Parsed Preview -->
        <div v-if="parsed" class="space-y-4">
          <div class="rounded-lg border p-3 space-y-2">
            <div class="flex items-center gap-2">
              <img v-if="getDbLogo(parsed.type)" :src="getDbLogo(parsed.type)" :alt="parsed.type" class="h-5 w-5" />
              <span class="text-sm font-medium capitalize">{{ parsed.type }}</span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div class="text-muted-foreground">Host</div>
              <div class="font-mono text-xs">{{ parsed.host }}</div>
              <div class="text-muted-foreground">Port</div>
              <div class="font-mono text-xs">{{ parsed.port }}</div>
              <template v-if="parsed.type !== DatabaseType.MongoDB">
                <div class="text-muted-foreground">Database</div>
                <div class="font-mono text-xs">{{ parsed.database || '—' }}</div>
              </template>
              <div v-if="parsed.username" class="text-muted-foreground">Username</div>
              <div v-if="parsed.username" class="font-mono text-xs">{{ parsed.username }}</div>
              <div v-if="parsed.password" class="text-muted-foreground">Password</div>
              <div v-if="parsed.password" class="font-mono text-xs">********</div>
            </div>
          </div>

          <!-- Connection Name -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">Connection Name</label>
            <Input v-model="connectionName" placeholder="My Database" class="h-8 text-sm" />
          </div>
        </div>

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
          <Button variant="outline" size="lg" :disabled="!isValid || isTesting" @click="handleTest">
            <IconLoader2 v-if="isTesting" class="h-4 w-4 mr-2 animate-spin" />
            Test Connection
          </Button>

          <div class="flex gap-2">
            <Button variant="outline" size="lg" @click="handleOpenChange(false)">
              Cancel
            </Button>
            <Button size="lg" :disabled="!isValid" @click="handleSave">
              Create Connection
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
