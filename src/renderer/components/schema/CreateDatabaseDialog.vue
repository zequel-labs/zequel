<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { sanitizeName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { IconLoader2, IconCheck, IconChevronDown } from '@tabler/icons-vue'
import { FocusScope } from 'reka-ui'
import { toast } from 'vue-sonner'
import { DatabaseType } from '@/types/connection'
import type { PgEncodingInfo, PgCollationInfo, CharsetInfo, CollationInfo } from '@/types/table'

const props = defineProps<{
  open: boolean
  connectionId: string
  connectionType: DatabaseType
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', databaseName: string): void
}>()

const newDbName = ref('')
const creating = ref(false)
const existingDatabases = ref<string[]>([])

// PostgreSQL encoding/collation
const pgEncodings = ref<PgEncodingInfo[]>([])
const pgCollations = ref<PgCollationInfo[]>([])
const selectedPgEncoding = ref('')
const selectedPgCollation = ref('')

// MySQL/MariaDB charset/collation
const mysqlCharsets = ref<CharsetInfo[]>([])
const mysqlCollations = ref<CollationInfo[]>([])
const selectedMysqlCharset = ref('')
const selectedMysqlCollation = ref('')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const isPostgres = computed(() => props.connectionType === DatabaseType.PostgreSQL)
const isMySQL = computed(() => props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB)

const isValidName = computed(() => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName.value)
})

const nameAlreadyExists = computed(() => {
  return existingDatabases.value.some(name => name.toLowerCase() === newDbName.value.toLowerCase())
})

const filteredMysqlCollations = computed(() => {
  if (!selectedMysqlCharset.value) return mysqlCollations.value
  return mysqlCollations.value.filter(c => c.charset === selectedMysqlCharset.value)
})

// Combobox selected objects (derived from string refs)
const selectedPgEncodingObj = computed(() =>
  pgEncodings.value.find(e => e.name === selectedPgEncoding.value)
)
const selectedPgCollationObj = computed(() =>
  pgCollations.value.find(c => c.name === selectedPgCollation.value)
)
const selectedMysqlCharsetObj = computed(() =>
  mysqlCharsets.value.find(c => c.charset === selectedMysqlCharset.value)
)
const selectedMysqlCollationObj = computed(() =>
  filteredMysqlCollations.value.find(c => c.collation === selectedMysqlCollation.value)
)

const buildCreateSQL = (name: string): string => {
  if (isMySQL.value) {
    let sql = `CREATE DATABASE \`${name}\``
    if (selectedMysqlCharset.value) {
      sql += ` CHARACTER SET ${selectedMysqlCharset.value}`
    }
    if (selectedMysqlCollation.value) {
      sql += ` COLLATE ${selectedMysqlCollation.value}`
    }
    return sql
  }
  if (isPostgres.value) {
    let sql = `CREATE DATABASE "${name}"`
    const hasEncoding = !!selectedPgEncoding.value
    const hasCollation = !!selectedPgCollation.value
    if (hasEncoding || hasCollation) {
      sql += ` TEMPLATE template0`
    }
    if (hasEncoding) {
      sql += ` ENCODING '${selectedPgEncoding.value}'`
    }
    if (hasCollation) {
      sql += ` LC_COLLATE '${selectedPgCollation.value}' LC_CTYPE '${selectedPgCollation.value}'`
    }
    return sql
  }
  return `CREATE DATABASE "${name}"`
}

const loadExistingDatabases = async () => {
  try {
    const dbs = await window.api.schema.databases(props.connectionId)
    existingDatabases.value = dbs.map(db => db.name)
  } catch {
    existingDatabases.value = []
  }
}

const loadEncodingOptions = async () => {
  if (isPostgres.value) {
    try {
      const [encodings, collations] = await Promise.all([
        window.api.schema.getPgEncodings(props.connectionId),
        window.api.schema.getPgCollations(props.connectionId)
      ])
      pgEncodings.value = encodings
      pgCollations.value = collations
    } catch {
      pgEncodings.value = []
      pgCollations.value = []
    }
  } else if (isMySQL.value) {
    try {
      const [charsets, collations] = await Promise.all([
        window.api.schema.getCharsets(props.connectionId),
        window.api.schema.getCollations(props.connectionId)
      ])
      mysqlCharsets.value = charsets
      mysqlCollations.value = collations
    } catch {
      mysqlCharsets.value = []
      mysqlCollations.value = []
    }
  }
}

const handleCreate = async () => {
  if (!isValidName.value || nameAlreadyExists.value || creating.value) return

  creating.value = true
  try {
    const sql = buildCreateSQL(newDbName.value)
    const result = await window.api.query.execute(props.connectionId, sql)
    if (result.error) {
      toast.error(`Failed to create database: ${result.error}`)
    } else {
      toast.success(`Database "${newDbName.value}" created`)
      const createdName = newDbName.value
      newDbName.value = ''
      isOpen.value = false
      emit('created', createdName)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create database')
  } finally {
    creating.value = false
  }
}

watch(() => props.open, (newVal) => {
  if (newVal && props.connectionId) {
    newDbName.value = ''
    selectedPgEncoding.value = ''
    selectedPgCollation.value = ''
    selectedMysqlCharset.value = ''
    selectedMysqlCollation.value = ''
    loadExistingDatabases()
    loadEncodingOptions()
  }
})

// When MySQL charset changes, reset collation if it no longer matches
watch(selectedMysqlCharset, () => {
  if (selectedMysqlCollation.value) {
    const stillValid = filteredMysqlCollations.value.some(c => c.collation === selectedMysqlCollation.value)
    if (!stillValid) {
      selectedMysqlCollation.value = ''
    }
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Create Database</DialogTitle>
        <DialogDescription class="sr-only">
          Create a new database.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3">
        <div class="flex flex-col gap-1">
          <Label>Name</Label>
          <Input :model-value="newDbName" @update:model-value="newDbName = sanitizeName($event)"
            placeholder="Enter database name" @keydown.enter="handleCreate" @keydown.escape="isOpen = false" />
          <p v-if="newDbName && !isValidName" class="text-xs text-destructive">
            Must start with a letter or underscore, alphanumeric only.
          </p>
          <p v-if="newDbName && isValidName && nameAlreadyExists" class="text-xs text-destructive">
            A database with this name already exists.
          </p>
        </div>

        <!-- PostgreSQL: Encoding & Collation -->
        <template v-if="isPostgres">
          <div class="flex flex-col gap-1">
            <Label>Encoding</Label>
            <FocusScope as-child>
              <Combobox :model-value="selectedPgEncodingObj" :display-value="(v: PgEncodingInfo) => v?.name ?? ''"
                @update:model-value="(v: PgEncodingInfo) => { selectedPgEncoding = v.name }">
                <ComboboxAnchor as-child>
                  <ComboboxTrigger as-child>
                    <Button variant="outline" size="lg" class="w-full justify-between">
                      {{ selectedPgEncodingObj ? selectedPgEncodingObj.name : 'Default' }}
                      <IconChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxList class="w-full">
                  <ComboboxInput placeholder="Search encoding..." />
                  <ComboboxEmpty>No encoding found</ComboboxEmpty>
                  <ComboboxGroup>
                    <ComboboxItem v-for="enc in pgEncodings" :key="enc.name" :value="enc">
                      <span class="min-w-0 flex-1 truncate">{{ enc.name }}</span>
                      <ComboboxItemIndicator>
                        <IconCheck class="ml-auto h-4 w-4" />
                      </ComboboxItemIndicator>
                    </ComboboxItem>
                  </ComboboxGroup>
                </ComboboxList>
              </Combobox>
            </FocusScope>
          </div>
          <div class="flex flex-col gap-1">
            <Label>Collation</Label>
            <FocusScope as-child>
              <Combobox :model-value="selectedPgCollationObj" :display-value="(v: PgCollationInfo) => v?.name ?? ''"
                @update:model-value="(v: PgCollationInfo) => { selectedPgCollation = v.name }">
                <ComboboxAnchor as-child>
                  <ComboboxTrigger as-child>
                    <Button variant="outline" size="lg" class="w-full justify-between">
                      {{ selectedPgCollationObj ? selectedPgCollationObj.name : 'Default' }}
                      <IconChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxList class="w-full">
                  <ComboboxInput placeholder="Search collation..." />
                  <ComboboxEmpty>No collation found</ComboboxEmpty>
                  <ComboboxGroup>
                    <ComboboxItem v-for="col in pgCollations" :key="col.name" :value="col">
                      <span class="min-w-0 flex-1 truncate">{{ col.name }}</span>
                      <ComboboxItemIndicator>
                        <IconCheck class="ml-auto h-4 w-4" />
                      </ComboboxItemIndicator>
                    </ComboboxItem>
                  </ComboboxGroup>
                </ComboboxList>
              </Combobox>
            </FocusScope>
          </div>
        </template>

        <!-- MySQL/MariaDB: Charset & Collation -->
        <template v-if="isMySQL">
          <div class="flex flex-col gap-1">
            <Label>Charset</Label>
            <FocusScope as-child>
              <Combobox :model-value="selectedMysqlCharsetObj" :display-value="(v: CharsetInfo) => v?.charset ?? ''"
                @update:model-value="(v: CharsetInfo) => { selectedMysqlCharset = v.charset }">
                <ComboboxAnchor as-child>
                  <ComboboxTrigger as-child>
                    <Button variant="outline" size="lg"  class="w-full justify-between">
                      {{ selectedMysqlCharsetObj ? selectedMysqlCharsetObj.charset : 'Default' }}
                      <IconChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxList class="w-full">
                  <ComboboxInput placeholder="Search charset..." />
                  <ComboboxEmpty>No charset found</ComboboxEmpty>
                  <ComboboxGroup>
                    <ComboboxItem v-for="cs in mysqlCharsets" :key="cs.charset" :value="cs">
                      <span class="min-w-0 flex-1 truncate">{{ cs.charset }}</span>
                      <ComboboxItemIndicator>
                        <IconCheck class="ml-auto h-4 w-4" />
                      </ComboboxItemIndicator>
                    </ComboboxItem>
                  </ComboboxGroup>
                </ComboboxList>
              </Combobox>
            </FocusScope>
          </div>
          <div class="flex flex-col gap-1">
            <Label>Collation</Label>
            <FocusScope as-child>
              <Combobox :model-value="selectedMysqlCollationObj"
                :display-value="(v: CollationInfo) => v?.collation ?? ''"
                @update:model-value="(v: CollationInfo) => { selectedMysqlCollation = v.collation }">
                <ComboboxAnchor as-child>
                  <ComboboxTrigger as-child>
                    <Button variant="outline" size="lg" class="w-full justify-between">
                      {{ selectedMysqlCollationObj ? selectedMysqlCollationObj.collation : 'Default' }}
                      <IconChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxList class="w-full">
                  <ComboboxInput placeholder="Search collation..." />
                  <ComboboxEmpty>No collation found</ComboboxEmpty>
                  <ComboboxGroup>
                    <ComboboxItem v-for="col in filteredMysqlCollations" :key="col.collation" :value="col">
                      <span class="min-w-0 flex-1 truncate">{{ col.collation }}</span>
                      <ComboboxItemIndicator>
                        <IconCheck class="ml-auto h-4 w-4" />
                      </ComboboxItemIndicator>
                    </ComboboxItem>
                  </ComboboxGroup>
                </ComboboxList>
              </Combobox>
            </FocusScope>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Cancel
        </Button>
        <Button :disabled="!newDbName || !isValidName || nameAlreadyExists || creating" @click="handleCreate">
          <IconLoader2 v-if="creating" class="h-4 w-4 mr-2 animate-spin" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>