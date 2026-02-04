<script setup lang="ts">
import { IconBrandAppleFilled, IconBrandWindowsFilled, IconBrandUbuntu } from '@tabler/icons-vue';
</script>

<template>
  <div class="platform-logos">
    <div class="platform-logo">
      <IconBrandAppleFilled :size="40" />
      <span>macOS</span>
    </div>
    <div class="platform-logo">
      <IconBrandWindowsFilled :size="40" />
      <span>Windows</span>
    </div>
    <div class="platform-logo">
      <IconBrandUbuntu :size="40" stroke-width="2" />
      <span>Linux</span>
    </div>
  </div>
</template>
