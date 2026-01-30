<script setup lang="ts">
import type { LabelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { Label } from "reka-ui"

import { cn } from "@/lib/utils"

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"], required?: boolean }>()

const delegatedProps = reactiveOmit(props, "class", "required")
</script>

<template>
  <Label data-slot="label" v-bind="delegatedProps" :class="cn(
    'flex items-center gap-0.5 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
    props.class,
  )
    ">
    <slot />
    <span v-if="required" class="text-red-500">*</span>
  </Label>
</template>