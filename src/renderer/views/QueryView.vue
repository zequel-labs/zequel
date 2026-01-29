<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useTabsStore, type QueryTabData } from '@/stores/tabs'
import { useQuery } from '@/composables/useQuery'
import { IconPlayerPlay, IconPlayerStop, IconLoader2 } from '@tabler/icons-vue'
import Button from '@/components/ui/Button.vue'
import SqlEditor from '@/components/editor/SqlEditor.vue'
import QueryResults from '@/components/editor/QueryResults.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const { executeQuery } = useQuery()

const editorRef = ref<InstanceType<typeof SqlEditor> | null>(null)

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as QueryTabData | undefined)

const sql = computed({
  get: () => tabData.value?.sql || '',
  set: (value) => tabsStore.setTabSql(props.tabId, value)
})

const result = computed(() => tabData.value?.result)
const isExecuting = computed(() => tabData.value?.isExecuting || false)

async function handleExecute() {
  const query = sql.value.trim()
  if (!query) return
  await executeQuery(query, props.tabId)
}

async function handleExecuteSelected() {
  const selected = editorRef.value?.getSelectedText()
  const query = selected?.trim() || sql.value.trim()
  if (!query) return
  await executeQuery(query, props.tabId)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <Button
        size="sm"
        :disabled="isExecuting || !sql.trim()"
        @click="handleExecute"
      >
        <IconLoader2 v-if="isExecuting" class="h-4 w-4 mr-1 animate-spin" />
        <IconPlayerPlay v-else class="h-4 w-4 mr-1" />
        {{ isExecuting ? 'Running...' : 'Run' }}
      </Button>

      <span class="text-xs text-muted-foreground">
        Ctrl+Enter to run
      </span>
    </div>

    <!-- Editor and Results -->
    <Splitpanes class="flex-1" horizontal>
      <Pane :size="50" :min-size="20">
        <SqlEditor
          ref="editorRef"
          v-model="sql"
          @execute="handleExecute"
          @execute-selected="handleExecuteSelected"
        />
      </Pane>

      <Pane :size="50" :min-size="20">
        <QueryResults
          :result="result"
          :is-executing="isExecuting"
        />
      </Pane>
    </Splitpanes>
  </div>
</template>
