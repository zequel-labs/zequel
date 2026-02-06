<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { IconLoader2, IconCopy, IconCheck } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

interface Props {
  tableName: string
  connectionId: string
}

const props = defineProps<Props>()

const ddl = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const copied = ref(false)

const loadDDL = async () => {
  isLoading.value = true
  error.value = null

  try {
    ddl.value = await window.api.schema.tableDDL(props.connectionId, props.tableName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load DDL'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDDL)

watch(
  () => [props.tableName, props.connectionId],
  loadDDL
)

const copyDDL = async () => {
  await navigator.clipboard.writeText(ddl.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
      <h3 class="text-sm font-medium">DDL / Create Statement</h3>
      <Button
        variant="ghost"
        :disabled="!ddl"
        @click="copyDDL"
      >
        <IconCheck v-if="copied" class="h-4 w-4 mr-1 text-green-500" />
        <IconCopy v-else class="h-4 w-4 mr-1" />
        {{ copied ? 'Copied!' : 'Copy' }}
      </Button>
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex-1 p-4"
    >
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- DDL Content -->
    <ScrollArea v-else class="flex-1 p-4">
      <pre class="text-sm font-mono whitespace-pre-wrap">{{ ddl }}</pre>
    </ScrollArea>
  </div>
</template>
