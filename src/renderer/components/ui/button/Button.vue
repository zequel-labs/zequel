<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."

import { IconLoader2 } from "@tabler/icons-vue"
import { Primitive } from "reka-ui"

import { cn } from "@/lib/utils"
import { buttonVariants } from "."

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  loading: false,
})
</script>

<template>
  <Primitive data-slot="button" :as="as" :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)">
    <div v-if="loading" class="flex items-center gap-2">
      <IconLoader2 class="animate-spin" />
      <div>
        Loading...
      </div>
    </div>
    <slot v-else />
  </Primitive>
</template>