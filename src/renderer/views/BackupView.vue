<script setup lang="ts">
import LegacyTransferTab from '@/components/backup/LegacyTransferTab.vue'
defineProps<{ tabId: string }>()
</script>
<template><LegacyTransferTab :tab-id="tabId" mode="backup" /></template>
