<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTabsStore, type RestoreTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { Button } from '@/components/ui/button'
import { IconChevronLeft, IconCheck } from '@tabler/icons-vue'
import StepRestoreConfigure from '@/components/restore/StepRestoreConfigure.vue'
import StepExecute from '@/components/backup/StepExecute.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const tabData = computed(() => {
  const tab = tabsStore.tabs.find(t => t.id === props.tabId)
  return tab?.data as RestoreTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const connection = computed(() => {
  if (!connectionId.value) return null
  return connectionsStore.connections.find(c => c.id === connectionId.value) || null
})

const connectionType = computed(() => connection.value?.type || '')

const currentStep = ref(1)

// Step 1 state
const restoreConfig = ref({
  inputPath: '',
  binaryPath: '',
  isDirectory: false,
  customArgs: '',
  options: {} as Record<string, boolean>,
})

// Full config for step 2
const fullConfig = computed(() => ({
  connectionId: connectionId.value,
  inputPath: restoreConfig.value.inputPath,
  binaryPath: restoreConfig.value.binaryPath,
  isDirectory: restoreConfig.value.isDirectory,
  customArgs: restoreConfig.value.customArgs,
  options: restoreConfig.value.options,
}))

const steps = [
  { number: 1, label: 'Configure Restore' },
  { number: 2, label: 'Review & Execute' },
]

const canGoNext = computed(() => {
  if (currentStep.value === 1) return restoreConfig.value.inputPath && restoreConfig.value.binaryPath
  return false
})

const goNext = () => {
  if (currentStep.value < 2) currentStep.value++
}

const goBack = () => {
  if (currentStep.value > 1) currentStep.value--
}

const goToStep = (step: number) => {
  if (step < currentStep.value) currentStep.value = step
}

const onConfigUpdate = (config: typeof restoreConfig.value) => {
  restoreConfig.value = config
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
            'cursor-pointer hover:text-foreground': step.number < currentStep,
            'cursor-default': step.number >= currentStep,
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
      <StepRestoreConfigure
        v-show="currentStep === 1"
        :connection-id="connectionId"
        :connection-type="connectionType"
        @update:config="onConfigUpdate"
      />
      <StepExecute
        v-if="currentStep === 2"
        mode="restore"
        :config="fullConfig"
      />
    </div>

    <!-- Footer Navigation -->
    <div class="flex items-center justify-between border-t px-6 py-3 shrink-0">
      <Button
        variant="outline"
        :disabled="currentStep === 1"
        data-testid="back-btn"
        @click="goBack"
      >
        <IconChevronLeft class="h-4 w-4 mr-1" />
        Back
      </Button>
      <Button
        v-if="currentStep < 2"
        :disabled="!canGoNext"
        data-testid="next-btn"
        @click="goNext"
      >
        Next: Review & Execute
      </Button>
    </div>
  </div>
</template>
