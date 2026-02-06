<script setup lang="ts">
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
import { ref, watchEffect, computed } from 'vue'
import type { DataTypeInfo } from '@/types/schema-operations'

interface TypeOption {
  value: string
  label: string
}

interface Props {
  modelValue?: string
  dataTypes: DataTypeInfo[]
  size?: 'default' | 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const options = computed<TypeOption[]>(() =>
  props.dataTypes.map(dt => ({ value: dt.name, label: dt.name }))
)

const selectedType = ref<TypeOption | undefined>()

watchEffect(() => {
  selectedType.value = options.value.find(
    (t) => t.value === props.modelValue,
  )
})
</script>

<template>
  <FocusScope as-child>
    <Combobox
      :model-value="selectedType"
      @update:model-value="
        (v: TypeOption) => {
          selectedType = v
          emit('update:modelValue', v.value)
        }
      "
    >
      <ComboboxAnchor as-child>
        <ComboboxTrigger as-child>
          <Button
            variant="outline"
            :class="[
              'w-full justify-between',
              size === 'sm' ? 'h-8 text-sm' : 'h-9'
            ]"
          >
            {{ selectedType ? selectedType.label : 'Select type...' }}
            <IconChevronDown
              class="ml-2 h-4 w-4 shrink-0 opacity-50"
            />
          </Button>
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxList class="w-full">
        <ComboboxInput placeholder="Search type..." />
        <ComboboxEmpty>No type found</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxItem
            v-for="t in options"
            :key="t.value"
            :value="t"
          >
            <span class="min-w-0 flex-1 truncate">{{ t.label }}</span>
            <ComboboxItemIndicator>
              <IconCheck class="ml-auto h-4 w-4" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxList>
    </Combobox>
  </FocusScope>
</template>
