<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  json: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: ''
})

const escapeHtml = (str: string): string => {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const highlightedHtml = computed(() => {
  if (!props.json) return ''
  return escapeHtml(props.json).replace(
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false)|(null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, bool, nul, num) => {
      if (key) return `<span class="text-blue-500 dark:text-blue-400">${key}</span>:`
      if (str) return `<span class="text-green-600 dark:text-green-400">${str}</span>`
      if (bool) return `<span class="text-amber-600 dark:text-amber-400">${bool}</span>`
      if (nul) return `<span class="text-red-400 dark:text-red-500">${nul}</span>`
      if (num) return `<span class="text-purple-600 dark:text-purple-400">${num}</span>`
      return match
    }
  )
})
</script>

<template>
  <pre :class="['font-mono whitespace-pre-wrap break-all', props.class]" v-html="highlightedHtml" />
</template>
