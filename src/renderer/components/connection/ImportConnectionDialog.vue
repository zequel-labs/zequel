<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ParsedConnectionUrl } from '@/lib/connection-url'
import { parseConnectionUrl } from '@/lib/connection-url'
import { DatabaseType } from '@/types/connection'
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

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'import', data: ParsedConnectionUrl): void
}>()

const urlInput = ref('')
const parseError = ref<string | null>(null)
const parsed = ref<ParsedConnectionUrl | null>(null)

const resetState = () => {
  urlInput.value = ''
  parseError.value = null
  parsed.value = null
}

watch(urlInput, (url) => {
  if (!url.trim()) {
    parsed.value = null
    parseError.value = null
    return
  }

  try {
    parsed.value = parseConnectionUrl(url)
    parseError.value = null
  } catch (e) {
    parsed.value = null
    parseError.value = e instanceof Error ? e.message : 'Invalid URL'
  }
})

const showDatabase = computed(() => {
  if (!parsed.value) return false
  return parsed.value.type !== DatabaseType.MongoDB && parsed.value.database
})

const handleImport = () => {
  if (!parsed.value) return
  emit('import', parsed.value)
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
    <DialogContent data-testid="import-url-dialog" class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Import from URL</DialogTitle>
        <DialogDescription>
          Paste a connection URL to fill in the connection form.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- URL Input -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Connection URL</label>
          <Input
            v-model="urlInput"
            data-testid="import-url-input"
            placeholder="postgresql://user:pass@host:5432/mydb"
            class="h-8 text-sm"
          />
          <p v-if="parseError" data-testid="import-url-error" class="text-sm text-red-500">{{ parseError }}</p>
        </div>

        <!-- Preview -->
        <div v-if="parsed" data-testid="import-url-preview" class="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Type</span>
              <span data-testid="import-url-preview-type" class="font-medium">{{ parsed.type }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Host</span>
              <span data-testid="import-url-preview-host" class="font-medium truncate ml-2">{{ parsed.host }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Port</span>
              <span data-testid="import-url-preview-port" class="font-medium">{{ parsed.port }}</span>
            </div>
            <div v-if="showDatabase" class="flex items-center justify-between">
              <span class="text-muted-foreground">Database</span>
              <span data-testid="import-url-preview-database" class="font-medium truncate ml-2">{{ parsed.database }}</span>
            </div>
            <div v-if="parsed.username" class="flex items-center justify-between">
              <span class="text-muted-foreground">Username</span>
              <span data-testid="import-url-preview-username" class="font-medium truncate ml-2">{{ parsed.username }}</span>
            </div>
            <div v-if="parsed.password" class="flex items-center justify-between">
              <span class="text-muted-foreground">Password</span>
              <span data-testid="import-url-preview-password" class="font-medium">********</span>
            </div>
            <div v-if="parsed.ssl" class="flex items-center justify-between">
              <span class="text-muted-foreground">SSL</span>
              <Badge data-testid="import-url-preview-ssl" variant="secondary" class="text-xs">{{ parsed.sslConfig?.mode || 'enabled' }}</Badge>
            </div>
            <div v-if="parsed.trustServerCertificate" class="flex items-center justify-between">
              <span class="text-muted-foreground">Trust Server Cert</span>
              <Badge data-testid="import-url-preview-trust-cert" variant="secondary" class="text-xs">yes</Badge>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="lg" data-testid="import-url-cancel-btn" @click="handleOpenChange(false)">
            Cancel
          </Button>
          <Button size="lg" :disabled="!parsed" data-testid="import-url-import-btn" @click="handleImport">
            Import
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
