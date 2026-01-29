<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconCode, IconPlus, IconX } from '@tabler/icons-vue'
import type { Column } from '@/types/table'
import type { IndexDefinition } from '@/types/schema-operations'

interface Props {
  open: boolean
  tableName: string
  connectionId: string
  columns: Column[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', index: IndexDefinition): void
  (e: 'close'): void
}>()

const showSqlPreview = ref(false)

// Form state
const name = ref('')
const selectedColumns = ref<string[]>([])
const unique = ref(false)

// Index definition
const indexDefinition = computed<IndexDefinition>(() => ({
  name: name.value,
  columns: selectedColumns.value,
  unique: unique.value
}))

// SQL preview
const sqlPreview = computed(() => {
  const idx = indexDefinition.value
  const uniqueKeyword = idx.unique ? 'UNIQUE ' : ''
  const columns = idx.columns.map((c) => `"${c}"`).join(', ')
  return `CREATE ${uniqueKeyword}INDEX "${idx.name}" ON "${props.tableName}" (${columns})`
})

// Auto-generate index name
const generateIndexName = computed(() => {
  if (selectedColumns.value.length === 0) return ''
  const prefix = unique.value ? 'uix' : 'idx'
  return `${prefix}_${props.tableName}_${selectedColumns.value.join('_')}`
})

function addColumn(columnName: string) {
  if (!selectedColumns.value.includes(columnName)) {
    selectedColumns.value.push(columnName)
    if (!name.value) {
      name.value = generateIndexName.value
    }
  }
}

function removeColumn(index: number) {
  selectedColumns.value.splice(index, 1)
  if (name.value === generateIndexName.value || !name.value) {
    name.value = generateIndexName.value
  }
}

function moveColumn(index: number, direction: 'up' | 'down') {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex >= 0 && newIndex < selectedColumns.value.length) {
    const temp = selectedColumns.value[index]
    selectedColumns.value[index] = selectedColumns.value[newIndex]
    selectedColumns.value[newIndex] = temp
  }
}

function resetForm() {
  name.value = ''
  selectedColumns.value = []
  unique.value = false
  showSqlPreview.value = false
}

function handleSave() {
  if (!name.value.trim() || selectedColumns.value.length === 0) return
  emit('save', indexDefinition.value)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})

watch(unique, () => {
  if (!name.value || name.value.startsWith('idx_') || name.value.startsWith('uix_')) {
    name.value = generateIndexName.value
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-xl" @close="handleClose">
      <DialogHeader>
        <DialogTitle>Create Index</DialogTitle>
        <DialogDescription>
          Create a new index on table '{{ tableName }}'
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- Index Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Index Name</label>
          <Input v-model="name" placeholder="idx_table_column" required />
        </div>

        <!-- Unique checkbox -->
        <div>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              v-model="unique"
              class="rounded border-input"
            />
            <span class="font-medium">Unique Index</span>
            <span class="text-muted-foreground">(prevents duplicate values)</span>
          </label>
        </div>

        <!-- Column Selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Columns</label>

          <!-- Selected columns -->
          <div v-if="selectedColumns.length > 0" class="space-y-1">
            <div
              v-for="(col, index) in selectedColumns"
              :key="col"
              class="flex items-center gap-2 p-2 rounded-md bg-muted"
            >
              <span class="text-sm text-muted-foreground w-6">{{ index + 1 }}.</span>
              <span class="flex-1 font-mono text-sm">{{ col }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1 rounded hover:bg-background disabled:opacity-50"
                  :disabled="index === 0"
                  @click="moveColumn(index, 'up')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="p-1 rounded hover:bg-background disabled:opacity-50"
                  :disabled="index === selectedColumns.length - 1"
                  @click="moveColumn(index, 'down')"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="p-1 rounded hover:bg-background text-red-500"
                  @click="removeColumn(index)"
                >
                  <IconX class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Available columns -->
          <div class="border rounded-md p-2 max-h-40 overflow-y-auto">
            <div
              v-for="col in columns"
              :key="col.name"
              :class="[
                'flex items-center justify-between p-2 rounded-md cursor-pointer',
                selectedColumns.includes(col.name)
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              ]"
              @click="addColumn(col.name)"
            >
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm">{{ col.name }}</span>
                <span class="text-xs text-muted-foreground">{{ col.type }}</span>
              </div>
              <IconPlus
                v-if="!selectedColumns.includes(col.name)"
                class="h-4 w-4 text-muted-foreground"
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Click columns to add them. The order matters for index efficiency.
          </p>
        </div>

        <!-- SQL Preview -->
        <div class="space-y-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            @click="showSqlPreview = !showSqlPreview"
          >
            <IconCode class="h-4 w-4" />
            {{ showSqlPreview ? 'Hide' : 'Show' }} SQL Preview
          </button>
          <pre
            v-if="showSqlPreview"
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto"
          >{{ sqlPreview }}</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">Cancel</Button>
        <Button
          @click="handleSave"
          :disabled="!name.trim() || selectedColumns.length === 0"
        >
          Create Index
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
