<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { IconKey, IconLink } from '@tabler/icons-vue'

export interface ERColumnData {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  isForeignKey: boolean
  isForeignKeyTarget: boolean
}

export interface ERTableNodeData {
  tableName: string
  columns: ERColumnData[]
  /** Color hue for the header (0-360), used to distinguish tables visually */
  headerColor: string
}

interface Props {
  id: string
  data: ERTableNodeData
}

const props = defineProps<Props>()

const columns = computed(() => props.data.columns)
const tableName = computed(() => props.data.tableName)
const headerBg = computed(() => props.data.headerColor || 'bg-primary')
</script>

<template>
  <div class="er-table-node rounded-lg shadow-md border border-border bg-card min-w-[220px] max-w-[320px]">
    <!-- Table header -->
    <div
      class="px-3 py-2 rounded-t-lg font-semibold text-sm flex items-center gap-2 text-primary-foreground"
      :class="headerBg"
    >
      <span class="truncate">{{ tableName }}</span>
      <span class="ml-auto text-[10px] opacity-75 font-normal">{{ columns.length }} cols</span>
    </div>

    <!-- Columns list -->
    <div class="divide-y divide-border">
      <div
        v-for="(column, index) in columns"
        :key="column.name"
        class="relative px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-muted/50 transition-colors"
      >
        <!-- Left handle (target) for FK target columns -->
        <Handle
          v-if="column.isForeignKeyTarget"
          type="target"
          :position="Position.Left"
          :id="`${id}-${column.name}-target`"
          class="!w-2.5 !h-2.5 !bg-foreground !border-foreground !border-2 !-left-[6px]"
          :style="{ top: 'auto' }"
        />

        <!-- Column icon -->
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <IconKey v-if="column.primaryKey" class="h-3.5 w-3.5" />
          <IconLink v-else-if="column.isForeignKey" class="h-3.5 w-3.5" />
          <span v-else class="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <!-- Column name -->
        <span class="font-medium truncate">
          {{ column.name }}
        </span>

        <!-- Nullable badge -->
        <span
          v-if="column.nullable"
          class="text-[9px] text-muted-foreground/60 italic"
        >
          null
        </span>

        <!-- Column type -->
        <span class="text-muted-foreground ml-auto shrink-0 text-[10px]">{{ column.type }}</span>

        <!-- Right handle (source) for FK source columns -->
        <Handle
          v-if="column.isForeignKey"
          type="source"
          :position="Position.Right"
          :id="`${id}-${column.name}-source`"
          class="!w-2.5 !h-2.5 !bg-foreground !border-foreground !border-2 !-right-[6px]"
          :style="{ top: 'auto' }"
        />
      </div>
    </div>

    <!-- Fallback handles if no per-column handles exist -->
    <Handle
      type="target"
      :position="Position.Left"
      :id="`${id}-default-target`"
      class="!w-2 !h-2 !bg-muted-foreground/50 !border-muted-foreground !border !opacity-0"
    />
    <Handle
      type="source"
      :position="Position.Right"
      :id="`${id}-default-source`"
      class="!w-2 !h-2 !bg-muted-foreground/50 !border-muted-foreground !border !opacity-0"
    />
  </div>
</template>
