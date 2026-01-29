<script setup lang="ts">
import { ref } from 'vue'
import {
  IconRefresh,
  IconDownload,
  IconFilter,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from '@tabler/icons-vue'
import Button from '../ui/Button.vue'
import Input from '../ui/Input.vue'

interface Props {
  totalCount: number
  offset: number
  limit: number
  isLoading?: boolean
  showFilters?: boolean
  activeFiltersCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'export'): void
  (e: 'page-change', offset: number): void
  (e: 'filter'): void
}>()

const currentPage = ref(Math.floor(props.offset / props.limit) + 1)
const totalPages = ref(Math.ceil(props.totalCount / props.limit))

function goToPage(page: number) {
  const newPage = Math.max(1, Math.min(page, totalPages.value))
  const newOffset = (newPage - 1) * props.limit
  currentPage.value = newPage
  emit('page-change', newOffset)
}

function goToFirstPage() {
  goToPage(1)
}

function goToPreviousPage() {
  goToPage(currentPage.value - 1)
}

function goToNextPage() {
  goToPage(currentPage.value + 1)
}

function goToLastPage() {
  goToPage(totalPages.value)
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <IconRefresh :class="['h-4 w-4 mr-1', isLoading ? 'animate-spin' : '']" />
        Refresh
      </Button>

      <Button
        :variant="showFilters ? 'default' : 'ghost'"
        size="sm"
        @click="emit('filter')"
      >
        <IconFilter class="h-4 w-4 mr-1" />
        Filter
        <span
          v-if="activeFiltersCount && activeFiltersCount > 0"
          class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground text-primary"
        >
          {{ activeFiltersCount }}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        @click="emit('export')"
      >
        <IconDownload class="h-4 w-4 mr-1" />
        Export
      </Button>
    </div>

    <div class="flex items-center gap-4">
      <span class="text-sm text-muted-foreground">
        {{ offset + 1 }}-{{ Math.min(offset + limit, totalCount) }} of {{ totalCount }}
      </span>

      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === 1"
          @click="goToFirstPage"
        >
          <IconChevronsLeft class="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === 1"
          @click="goToPreviousPage"
        >
          <IconChevronLeft class="h-4 w-4" />
        </Button>

        <div class="flex items-center gap-1 text-sm">
          <span>Page</span>
          <Input
            :model-value="String(currentPage)"
            type="number"
            class="w-14 h-8 text-center"
            @change="goToPage(Number(($event.target as HTMLInputElement).value))"
          />
          <span>of {{ totalPages }}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === totalPages"
          @click="goToNextPage"
        >
          <IconChevronRight class="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="currentPage === totalPages"
          @click="goToLastPage"
        >
          <IconChevronsRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
