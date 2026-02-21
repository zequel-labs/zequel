<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IconSearch, IconLoader2, IconChevronDown, IconChevronRight } from '@tabler/icons-vue'
import { DatabaseType } from '@/types/connection'

export interface BackupEntity {
  name: string
  schema?: string
  type: string
}

interface Props {
  connectionId: string
  connectionType: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:entities', entities: BackupEntity[]): void
}>()

const entities = ref<BackupEntity[]>([])
const selected = ref<Set<string>>(new Set())
const search = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const expandedSchemas = ref<Set<string>>(new Set())

const entityKey = (entity: BackupEntity): string => {
  return entity.schema ? `${entity.schema}.${entity.name}` : entity.name
}

// Group entities by schema (for PostgreSQL)
const schemaGroups = computed(() => {
  const groups = new Map<string, BackupEntity[]>()
  for (const entity of filteredEntities.value) {
    const schema = entity.schema || ''
    if (!groups.has(schema)) groups.set(schema, [])
    groups.get(schema)!.push(entity)
  }
  return groups
})

const hasSchemas = computed(() => {
  return props.connectionType === DatabaseType.PostgreSQL && [...schemaGroups.value.keys()].some(s => s !== '')
})

const filteredEntities = computed(() => {
  if (!search.value.trim()) return entities.value
  const q = search.value.toLowerCase()
  return entities.value.filter(e => e.name.toLowerCase().includes(q))
})

const selectedCount = computed(() => selected.value.size)
const totalCount = computed(() => entities.value.length)

const toggleEntity = (entity: BackupEntity) => {
  const key = entityKey(entity)
  const next = new Set(selected.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  selected.value = next
  emitSelected()
}

const toggleSchema = (schema: string) => {
  const schemaEntities = schemaGroups.value.get(schema) || []
  const keys = schemaEntities.map(entityKey)
  const allSelected = keys.every(k => selected.value.has(k))

  const next = new Set(selected.value)
  if (allSelected) {
    keys.forEach(k => next.delete(k))
  } else {
    keys.forEach(k => next.add(k))
  }
  selected.value = next
  emitSelected()
}

const toggleExpandSchema = (schema: string) => {
  const next = new Set(expandedSchemas.value)
  if (next.has(schema)) {
    next.delete(schema)
  } else {
    next.add(schema)
  }
  expandedSchemas.value = next
}

const selectAll = () => {
  selected.value = new Set(entities.value.map(entityKey))
  emitSelected()
}

const deselectAll = () => {
  selected.value = new Set()
  emitSelected()
}

const emitSelected = () => {
  const selectedEntities = entities.value.filter(e => selected.value.has(entityKey(e)))
  emit('update:entities', selectedEntities)
}

const isSchemaAllSelected = (schema: string): boolean => {
  const schemaEntities = schemaGroups.value.get(schema) || []
  return schemaEntities.every(e => selected.value.has(entityKey(e)))
}

const isSchemaSomeSelected = (schema: string): boolean => {
  const schemaEntities = schemaGroups.value.get(schema) || []
  return schemaEntities.some(e => selected.value.has(entityKey(e))) && !isSchemaAllSelected(schema)
}

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    const result = await window.api.nativeBackup.getEntities(props.connectionId)
    entities.value = result
    // Select all by default
    selected.value = new Set(result.map(entityKey))
    // Expand all schemas by default
    const schemas = new Set(result.map(e => e.schema || '').filter(Boolean))
    expandedSchemas.value = schemas
    emitSelected()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load entities'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <!-- Header with search and bulk actions -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" placeholder="Search entities..." class="pl-9" data-testid="entity-search" />
      </div>
      <Button variant="outline" size="sm" data-testid="select-all-btn" @click="selectAll">Select All</Button>
      <Button variant="outline" size="sm" data-testid="deselect-all-btn" @click="deselectAll">Deselect All</Button>
    </div>

    <!-- Count -->
    <div class="text-xs text-muted-foreground" data-testid="entity-count">
      {{ selectedCount }} of {{ totalCount }} selected
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <IconLoader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-destructive py-4">
      {{ error }}
    </div>

    <!-- Entity list -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto border rounded-md" data-testid="entity-list">
      <!-- Schema-grouped view (PostgreSQL) -->
      <template v-if="hasSchemas">
        <div v-for="[schema, items] in schemaGroups" :key="schema">
          <button
            :data-testid="`entity-schema-${schema}`"
            class="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium hover:bg-accent/50 border-b"
            @click="toggleExpandSchema(schema)"
          >
            <component :is="expandedSchemas.has(schema) ? IconChevronDown : IconChevronRight" class="h-4 w-4 shrink-0" />
            <input
              type="checkbox"
              :checked="isSchemaAllSelected(schema)"
              :indeterminate="isSchemaSomeSelected(schema)"
              class="rounded border-border"
              @click.stop="toggleSchema(schema)"
            />
            <span>{{ schema }}</span>
            <span class="text-xs text-muted-foreground ml-auto">{{ items.length }} items</span>
          </button>
          <div v-if="expandedSchemas.has(schema)">
            <label
              v-for="entity in items"
              :key="entityKey(entity)"
              :data-testid="`entity-item-${entity.name}`"
              class="flex items-center gap-2 px-3 py-1.5 pl-10 text-sm hover:bg-accent/30 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selected.has(entityKey(entity))"
                class="rounded border-border"
                @change="toggleEntity(entity)"
              />
              <span>{{ entity.name }}</span>
              <span class="text-xs text-muted-foreground capitalize">({{ entity.type }})</span>
            </label>
          </div>
        </div>
      </template>

      <!-- Flat list view (MySQL, SQLite, etc.) -->
      <template v-else>
        <label
          v-for="entity in filteredEntities"
          :key="entityKey(entity)"
          :data-testid="`entity-item-${entity.name}`"
          class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/30 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selected.has(entityKey(entity))"
            class="rounded border-border"
            @change="toggleEntity(entity)"
          />
          <span>{{ entity.name }}</span>
          <span class="text-xs text-muted-foreground capitalize">({{ entity.type }})</span>
        </label>
      </template>

      <!-- Empty state -->
      <div v-if="filteredEntities.length === 0 && !isLoading" class="p-4 text-sm text-muted-foreground text-center">
        No entities found
      </div>
    </div>
  </div>
</template>
