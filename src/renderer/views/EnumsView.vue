<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type EnumsTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Copy, Check, List, RefreshCw } from 'lucide-vue-next'
import type { EnumType } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const enums = ref<EnumType[]>([])
const copied = ref<string | null>(null)

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as EnumsTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const schemaName = computed(() => tabData.value?.schema)

// Group enums by schema
const enumsBySchema = computed(() => {
  const grouped = new Map<string, EnumType[]>()
  for (const e of enums.value) {
    const schema = e.schema || 'public'
    if (!grouped.has(schema)) {
      grouped.set(schema, [])
    }
    grouped.get(schema)!.push(e)
  }
  return grouped
})

async function loadEnums() {
  if (!connectionId.value) return

  loading.value = true
  error.value = null

  try {
    enums.value = await window.api.schema.getAllEnums(connectionId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load enums'
    console.error('Error loading enums:', err)
  } finally {
    loading.value = false
  }
}

async function copyValues(enumType: EnumType) {
  const values = enumType.values.map(v => `'${v}'`).join(', ')
  try {
    await navigator.clipboard.writeText(values)
    copied.value = enumType.name
    setTimeout(() => {
      copied.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function generateCreateDDL(enumType: EnumType): string {
  const values = enumType.values.map(v => `  '${v}'`).join(',\n')
  return `CREATE TYPE "${enumType.schema}"."${enumType.name}" AS ENUM (\n${values}\n);`
}

async function copyDDL(enumType: EnumType) {
  const ddl = generateCreateDDL(enumType)
  try {
    await navigator.clipboard.writeText(ddl)
    copied.value = `${enumType.name}_ddl`
    setTimeout(() => {
      copied.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

onMounted(() => {
  loadEnums()
})

watch(connectionId, () => {
  loadEnums()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <List class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">Enum Types</h1>
        </div>
        <Badge variant="outline">{{ enums.length }} types</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="loadEnums">
          <RefreshCw class="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" @click="loadEnums">
          Retry
        </Button>
      </div>

      <!-- Empty State -->
      <div v-else-if="enums.length === 0" class="flex flex-col items-center justify-center h-full gap-4">
        <List class="h-12 w-12 text-muted-foreground opacity-50" />
        <p class="text-muted-foreground">No enum types found in this database.</p>
      </div>

      <!-- Enums List -->
      <div v-else class="space-y-6 max-w-4xl mx-auto">
        <div v-for="[schema, schemaEnums] in enumsBySchema" :key="schema" class="space-y-4">
          <h2 class="text-sm font-medium text-muted-foreground">
            Schema: {{ schema }}
          </h2>

          <div class="grid gap-4 md:grid-cols-2">
            <Card v-for="enumType in schemaEnums" :key="enumType.name">
              <CardHeader class="pb-2">
                <div class="flex items-center justify-between">
                  <CardTitle class="text-base font-mono">{{ enumType.name }}</CardTitle>
                  <div class="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 p-0"
                      @click="copyValues(enumType)"
                      title="Copy values"
                    >
                      <component :is="copied === enumType.name ? Check : Copy" class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 p-0"
                      @click="copyDDL(enumType)"
                      title="Copy DDL"
                    >
                      <component :is="copied === `${enumType.name}_ddl` ? Check : Copy" class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {{ enumType.values.length }} values
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea class="max-h-32">
                  <div class="flex flex-wrap gap-1">
                    <Badge
                      v-for="value in enumType.values"
                      :key="value"
                      variant="secondary"
                      class="font-mono text-xs"
                    >
                      {{ value }}
                    </Badge>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
