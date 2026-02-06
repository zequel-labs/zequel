<script setup lang="ts">
import { DatabaseType } from '@/types/connection'
import { Button } from '@/components/ui/button'
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
import { IconCheck, IconChevronDown } from '@tabler/icons-vue'
import { FocusScope } from 'reka-ui'
import { ref, watchEffect } from 'vue'

interface DatabaseOption {
  value: DatabaseType
  label: string
}

interface Props {
  modelValue?: DatabaseType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: DatabaseType]
}>()

const databaseTypes: DatabaseOption[] = [
  { value: DatabaseType.PostgreSQL, label: 'PostgreSQL' },
  { value: DatabaseType.MySQL, label: 'MySQL' },
  { value: DatabaseType.MariaDB, label: 'MariaDB' },
  { value: DatabaseType.SQLite, label: 'SQLite' },
  { value: DatabaseType.ClickHouse, label: 'ClickHouse' },
  { value: DatabaseType.MongoDB, label: 'MongoDB' },
  { value: DatabaseType.Redis, label: 'Redis' },
]

const selectedType = ref<DatabaseOption | undefined>()

watchEffect(() => {
  selectedType.value = databaseTypes.find(
    (db) => db.value === props.modelValue,
  )
})
</script>

<template>
  <FocusScope as-child>
    <Combobox :model-value="selectedType" @update:model-value="
      (v: DatabaseOption) => {
        selectedType = v
        emit('update:modelValue', v.value)
      }
    ">
      <ComboboxAnchor as-child>
        <ComboboxTrigger as-child>
          <Button variant="outline" size="lg" class="w-full justify-between">
            {{ selectedType ? selectedType.label : 'Select database type...' }}
            <IconChevronDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxList class="w-full">
        <ComboboxInput placeholder="Search database type..." />
        <ComboboxEmpty>No database type found</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxItem v-for="db in databaseTypes" :key="db.value" :value="db">
            <span class="min-w-0 flex-1 truncate">{{ db.label }}</span>
            <ComboboxItemIndicator>
              <IconCheck class="ml-auto h-4 w-4" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxList>
    </Combobox>
  </FocusScope>
</template>