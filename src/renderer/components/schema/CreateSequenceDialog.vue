<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, Hash } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DatabaseSchema } from '@/types/table'

const props = defineProps<{
  open: boolean
  connectionId: string
  currentSchema?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', sequenceName: string, schema: string): void
}>()

const loading = ref(false)
const schemas = ref<DatabaseSchema[]>([])

const form = ref({
  name: '',
  schema: '',
  dataType: 'bigint',
  startWith: '1',
  increment: '1',
  minValue: '',
  maxValue: '',
  cache: '1',
  cycle: false,
  ownedBy: ''
})

const dataTypes = ['smallint', 'integer', 'bigint']

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const loadSchemas = async () => {
  try {
    schemas.value = await window.api.schema.getSchemas(props.connectionId)
    if (props.currentSchema) {
      form.value.schema = props.currentSchema
    } else if (schemas.value.length > 0) {
      const publicSchema = schemas.value.find(s => s.name === 'public')
      form.value.schema = publicSchema?.name || schemas.value[0].name
    }
  } catch (err) {
    console.error('Failed to load schemas:', err)
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    schema: props.currentSchema || 'public',
    dataType: 'bigint',
    startWith: '1',
    increment: '1',
    minValue: '',
    maxValue: '',
    cache: '1',
    cycle: false,
    ownedBy: ''
  }
}

const createSequence = async () => {
  if (!form.value.name.trim()) {
    toast.error('Sequence name is required')
    return
  }

  loading.value = true

  try {
    const request: Parameters<typeof window.api.schema.createSequence>[1] = {
      sequence: {
        name: form.value.name.trim(),
        schema: form.value.schema,
        dataType: form.value.dataType
      }
    }

    if (form.value.startWith) {
      request.sequence.startWith = parseInt(form.value.startWith, 10)
    }
    if (form.value.increment) {
      request.sequence.increment = parseInt(form.value.increment, 10)
    }
    if (form.value.minValue) {
      request.sequence.minValue = parseInt(form.value.minValue, 10)
    }
    if (form.value.maxValue) {
      request.sequence.maxValue = parseInt(form.value.maxValue, 10)
    }
    if (form.value.cache) {
      request.sequence.cache = parseInt(form.value.cache, 10)
    }
    if (form.value.cycle) {
      request.sequence.cycle = true
    }
    if (form.value.ownedBy) {
      request.sequence.ownedBy = form.value.ownedBy
    }

    const result = await window.api.schema.createSequence(props.connectionId, request)

    if (result.success) {
      toast.success(`Sequence "${form.value.name}" created successfully`)
      emit('created', form.value.name, form.value.schema)
      isOpen.value = false
      resetForm()
    } else {
      toast.error(`Failed to create sequence: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create sequence')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (newVal) => {
  if (newVal && props.connectionId) {
    loadSchemas()
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Hash class="h-5 w-5" />
          Create Sequence
        </DialogTitle>
        <DialogDescription>
          Create a new sequence in your PostgreSQL database.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">Name *</Label>
            <Input
              id="name"
              v-model="form.name"
              placeholder="sequence_name"
            />
          </div>
          <div class="space-y-2">
            <Label for="schema">Schema</Label>
            <Select v-model="form.schema">
              <SelectTrigger>
                <SelectValue placeholder="Select schema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="s in schemas.filter(s => !s.isSystem)"
                  :key="s.name"
                  :value="s.name"
                >
                  {{ s.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="dataType">Data Type</Label>
            <Select v-model="form.dataType">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="dt in dataTypes" :key="dt" :value="dt">
                  {{ dt }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="startWith">Start With</Label>
            <Input
              id="startWith"
              v-model="form.startWith"
              type="number"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="increment">Increment</Label>
            <Input
              id="increment"
              v-model="form.increment"
              type="number"
            />
          </div>
          <div class="space-y-2">
            <Label for="cache">Cache</Label>
            <Input
              id="cache"
              v-model="form.cache"
              type="number"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="minValue">Min Value</Label>
            <Input
              id="minValue"
              v-model="form.minValue"
              type="number"
              placeholder="Default"
            />
          </div>
          <div class="space-y-2">
            <Label for="maxValue">Max Value</Label>
            <Input
              id="maxValue"
              v-model="form.maxValue"
              type="number"
              placeholder="Default"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="ownedBy">Owned By (table.column)</Label>
          <Input
            id="ownedBy"
            v-model="form.ownedBy"
            placeholder="e.g., users.id"
          />
        </div>

        <div class="flex items-center space-x-2">
          <Checkbox
            id="cycle"
            :checked="form.cycle"
            @update:checked="form.cycle = $event"
          />
          <Label for="cycle">Cycle (restart when max value is reached)</Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Cancel
        </Button>
        <Button @click="createSequence" :disabled="loading || !form.name.trim()">
          <Loader2 v-if="loading" class="h-4 w-4 mr-2 animate-spin" />
          Create Sequence
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
