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

<style scoped>
.platform-logos {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin: 24px 0;
}
.platform-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
}
.platform-logo span {
  font-size: 14px;
  font-weight: 500;
}
@media (max-width: 640px) {
  .platform-logos {
    gap: 24px;
  }
}
</style>
