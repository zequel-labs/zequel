<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTabsStore, type BackupTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { Button } from '@/components/ui/button'
import { IconChevronLeft, IconChevronRight, IconCheck } from '@tabler/icons-vue'
import StepEntities from '@/components/backup/StepEntities.vue'
import StepConfigure from '@/components/backup/StepConfigure.vue'
import StepExecute from '@/components/backup/StepExecute.vue'
import type { BackupEntity } from '@/components/backup/StepEntities.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const tabData = computed(() => {
  const tab = tabsStore.tabs.find(t => t.id === props.tabId)
  return tab?.data as BackupTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const connection = computed(() => {
  if (!connectionId.value) return null
  return connectionsStore.getConnectionForSession(connectionId.value)
})

const connectionType = computed(() => connection.value?.type || '')

const currentStep = ref(1)

// Step 1 state
const selectedEntities = ref<BackupEntity[]>([])

// Step 2 state
const backupConfig = ref({
  outputPath: '',
  binaryPath: '',
  compress: false,
  customArgs: '',
  options: {} as Record<string, boolean>,
})

// Full config for step 3
const fullConfig = computed(() => ({
  connectionId: connectionId.value,
  entities: selectedEntities.value.map(e => ({
    name: e.name,
    schema: e.schema,
    type: e.type,
  })),
  outputPath: backupConfig.value.outputPath,
  binaryPath: backupConfig.value.binaryPath,
  compress: backupConfig.value.compress,
  customArgs: backupConfig.value.customArgs,
  options: backupConfig.value.options,
}))

const steps = [
  { number: 1, label: 'Choose Entities' },
  { number: 2, label: 'Configure' },
  { number: 3, label: 'Execute' },
]

const isExecuting = ref(false)

const canGoNext = computed(() => {
  if (currentStep.value === 1) return selectedEntities.value.length > 0
  if (currentStep.value === 2) return backupConfig.value.outputPath && backupConfig.value.binaryPath
  return false
})

const goNext = () => {
  if (currentStep.value < 3) currentStep.value++
}

const goBack = () => {
  if (currentStep.value > 1 && !isExecuting.value) currentStep.value--
}

const goToStep = (step: number) => {
  if (step < currentStep.value && !isExecuting.value) currentStep.value = step
}

const onEntitiesUpdate = (entities: BackupEntity[]) => {
  selectedEntities.value = entities
}

const onConfigUpdate = (config: typeof backupConfig.value) => {
  backupConfig.value = config
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Stepper Header -->
    <div class="flex items-center border-b px-6 py-3 gap-0 shrink-0">
      <template v-for="(step, i) in steps" :key="step.number">
        <button
          class="flex items-center gap-2 text-sm transition-colors"
          :class="{
            'text-foreground font-medium': currentStep === step.number,
            'text-muted-foreground': currentStep !== step.number,
            'cursor-pointer hover:text-foreground': step.number < currentStep && !isExecuting,
            'cursor-default': step.number >= currentStep || isExecuting,
          }"
          :data-testid="`step-${step.number}-btn`"
          @click="goToStep(step.number)"
        >
          <span
            class="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border transition-colors"
            :class="{
              'bg-foreground text-background border-foreground': currentStep === step.number,
              'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50': step.number < currentStep,
              'bg-muted border-border': step.number > currentStep,
            }"
          >
            <IconCheck v-if="step.number < currentStep" class="h-3.5 w-3.5" />
            <template v-else>{{ step.number }}</template>
          </span>
          <span>{{ step.label }}</span>
        </button>
        <div
          v-if="i < steps.length - 1"
          class="flex-1 h-px mx-4"
          :class="step.number < currentStep ? 'bg-green-500/50' : 'bg-border'"
        />
      </template>
    </div>

    <!-- Step Content -->
    <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <StepEntities
        v-show="currentStep === 1"
        :connection-id="connectionId"
        :connection-type="connectionType"
        @update:entities="onEntitiesUpdate"
      />
      <StepConfigure
        v-show="currentStep === 2"
        :connection-id="connectionId"
        :connection-type="connectionType"
        @update:config="onConfigUpdate"
      />
      <StepExecute
        v-if="currentStep === 3"
        mode="backup"
        :config="fullConfig"
        @update:running="isExecuting = $event"
      />
    </div>

    <!-- Footer Navigation -->
    <div class="flex items-center justify-between border-t px-6 py-3 shrink-0">
      <Button
        variant="outline"
        :disabled="currentStep === 1 || isExecuting"
        data-testid="back-btn"
        @click="goBack"
      >
        <IconChevronLeft class="h-4 w-4 mr-1" />
        Back
      </Button>
      <Button
        v-if="currentStep < 3"
        :disabled="!canGoNext"
        data-testid="next-btn"
        @click="goNext"
      >
        Next
        <IconChevronRight class="h-4 w-4 ml-1" />
      </Button>
    </div>
  </div>
</template>
