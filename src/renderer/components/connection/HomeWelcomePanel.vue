<script setup lang="ts">
import { IconDatabase } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

const emit = defineEmits<{
  (e: 'new-connection'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full text-center px-6">
    <div class="rounded-full bg-muted p-5 mb-5">
      <IconDatabase class="h-10 w-10 text-muted-foreground" />
    </div>
    <h2 class="text-xl font-semibold tracking-tight mb-1.5">Zequel</h2>
    <p class="text-sm text-muted-foreground mb-4">Select a connection or create a new one</p>
    <Button variant="default" size="sm" @click="emit('new-connection')">
      New Connection
    </Button>
  </div>
</template>
