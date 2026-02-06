<script setup lang="ts">
import type { ComboboxInputEmits, ComboboxInputProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { IconSearch } from '@tabler/icons-vue'
import {
  ComboboxInput,

  useForwardPropsEmits,
} from "reka-ui"

import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<
  ComboboxInputProps & {
    class?: HTMLAttributes["class"]
  }
>()

const emits = defineEmits<ComboboxInputEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <div data-slot="command-input-wrapper" class="flex h-7 items-center gap-2 border-b px-2">
    <IconSearch class="size-3.5 shrink-0 opacity-50" />
    <ComboboxInput data-slot="command-input" :class="cn(
      'placeholder:text-muted-foreground flex w-full rounded-md bg-transparent py-1 text-xs outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )
      " v-bind="{ ...forwarded, ...$attrs }">
      <slot />
    </ComboboxInput>
  </div>
</template>