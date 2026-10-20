<script setup lang="ts">
import type { SplitterPanelEmits, SplitterPanelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SplitterPanel, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<SplitterPanelProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<SplitterPanelEmits>()

const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterPanel data-slot="resizable-panel" v-bind="forwarded" :class="cn(props.class)">
    <slot />
  </SplitterPanel>
</template>
