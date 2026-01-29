<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { IconCode, IconEye, IconAlertCircle } from '@tabler/icons-vue'
import type { ViewDefinition } from '@/types/schema-operations'

interface Props {
  open: boolean
  connectionId: string
  database?: string
  mode?: 'create' | 'edit'
  existingViewName?: string
  existingSelectStatement?: string
}

const props = withDefaults(defineProps<Props>(), {
  database: '',
  mode: 'create',
  existingViewName: '',
  existingSelectStatement: ''
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', view: ViewDefinition): void
  (e: 'close'): void
}>()

const showSqlPreview = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Form state
const viewName = ref('')
const selectStatement = ref('')
const replaceIfExists = ref(false)

// View definition
const viewDefinition = computed<ViewDefinition>(() => ({
  name: viewName.value,
  selectStatement: selectStatement.value,
  replaceIfExists: replaceIfExists.value
}))

// SQL preview
const sqlPreview = computed(() => {
  if (!viewName.value || !selectStatement.value.trim()) {
    return '-- Enter view name and SELECT statement'
  }

  const createOrReplace = replaceIfExists.value ? 'CREATE OR REPLACE VIEW' : 'CREATE VIEW'
  return `${createOrReplace} "${viewName.value}" AS\n${selectStatement.value};`
})

// Validation
const isValid = computed(() => {
  return viewName.value.trim().length > 0 && selectStatement.value.trim().length > 0
})

function resetForm() {
  if (props.mode === 'edit') {
    viewName.value = props.existingViewName
    selectStatement.value = props.existingSelectStatement
    replaceIfExists.value = true
  } else {
    viewName.value = ''
    selectStatement.value = ''
    replaceIfExists.value = false
  }
  showSqlPreview.value = false
  error.value = null
}

async function handleSave() {
  if (!isValid.value) return

  isLoading.value = true
  error.value = null

  try {
    emit('save', viewDefinition.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save view'
  } finally {
    isLoading.value = false
  }
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
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-3xl max-h-[90vh]" @close="handleClose">
      <DialogHeader>
        <DialogTitle>
          <div class="flex items-center gap-2">
            <IconEye class="h-5 w-5 text-purple-500" />
            {{ mode === 'edit' ? 'Edit View' : 'Create View' }}
          </div>
        </DialogTitle>
        <DialogDescription>
          {{ database ? `${mode === 'edit' ? 'Edit' : 'Create'} a view in database '${database}'` : `${mode === 'edit' ? 'Edit' : 'Create'} a database view` }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- Error Alert -->
        <div v-if="error" class="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          <IconAlertCircle class="h-4 w-4 flex-shrink-0" />
          {{ error }}
        </div>

        <!-- View Name -->
        <div class="space-y-2">
          <Label for="view-name">View Name</Label>
          <Input
            id="view-name"
            v-model="viewName"
            placeholder="my_view"
            :disabled="mode === 'edit'"
            required
          />
          <p v-if="mode === 'edit'" class="text-xs text-muted-foreground">
            View name cannot be changed. Drop and recreate to rename.
          </p>
        </div>

        <!-- SELECT Statement -->
        <div class="space-y-2">
          <Label for="select-statement">SELECT Statement</Label>
          <Textarea
            id="select-statement"
            v-model="selectStatement"
            placeholder="SELECT column1, column2 FROM table_name WHERE condition"
            rows="8"
            class="font-mono text-sm"
            required
          />
          <p class="text-xs text-muted-foreground">
            Enter the SELECT statement that defines this view. Do not include CREATE VIEW syntax.
          </p>
        </div>

        <!-- Options -->
        <div class="flex items-center gap-2">
          <Checkbox
            id="replace-if-exists"
            :checked="replaceIfExists"
            @update:checked="replaceIfExists = $event"
          />
          <Label for="replace-if-exists" class="cursor-pointer">
            Replace if exists (CREATE OR REPLACE VIEW)
          </Label>
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
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-40"
          >{{ sqlPreview }}</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose" :disabled="isLoading">
          Cancel
        </Button>
        <Button
          @click="handleSave"
          :disabled="!isValid || isLoading"
        >
          {{ isLoading ? 'Saving...' : (mode === 'edit' ? 'Update View' : 'Create View') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
