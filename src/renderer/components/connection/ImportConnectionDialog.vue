<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ParsedConnectionUrl } from '@/lib/connection-url'
import { parseConnectionUrl } from '@/lib/connection-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <DialogContent class="max-w-xl">
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
            placeholder="postgresql://user:pass@host:5432/mydb"
            class="h-8 text-sm"
          />
          <p v-if="parseError" class="text-sm text-red-500">{{ parseError }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="lg" @click="handleOpenChange(false)">
            Cancel
          </Button>
          <Button size="lg" :disabled="!parsed" @click="handleImport">
            Import
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
