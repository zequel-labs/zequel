<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'
import { formatSql, type SqlDialect } from '@/lib/sql-formatter'
import { buildProvideCompletionItems } from '@/lib/sql-completion/completion-provider'

// Re-export SchemaMetadata for backwards compatibility
export type { SchemaMetadata } from '@/lib/sql-completion/types'
import type { SchemaMetadata } from '@/lib/sql-completion/types'

interface Props {
  modelValue: string
  readonly?: boolean
  language?: string
  schema?: SchemaMetadata
  dialect?: SqlDialect
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  readonly: false,
  language: 'sql',
  schema: undefined,
  dialect: 'postgresql'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'execute'): void
  (e: 'execute-selected'): void
  (e: 'format'): void
}>()

const settingsStore = useSettingsStore()
const { isDark } = useTheme()

const editorRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const editorTheme = computed(() => isDark.value ? 'vs-dark' : 'vs')

// Store completion provider disposable to update it when schema changes
let completionDisposable: monaco.IDisposable | null = null

const registerCompletionProvider = () => {
  completionDisposable?.dispose()

  const editorModel = editor?.getModel()
  if (!editorModel) return

  completionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: buildProvideCompletionItems(editorModel, props.schema, props.dialect)
  })
}

onMounted(() => {
  if (editorRef.value) {
    editor = monaco.editor.create(editorRef.value, {
      value: props.modelValue,
      language: props.language,
      theme: editorTheme.value,
      automaticLayout: true,
      minimap: { enabled: settingsStore.editorSettings.minimap },
      fontSize: settingsStore.editorSettings.fontSize,
      tabSize: settingsStore.editorSettings.tabSize,
      wordWrap: settingsStore.editorSettings.wordWrap ? 'on' : 'off',
      lineNumbers: settingsStore.editorSettings.lineNumbers ? 'on' : 'off',
      readOnly: props.readonly,
      scrollBeyondLastLine: false,
      padding: { top: 10, bottom: 10 },
      lineDecorationsWidth: 4,
      lineNumbersMinChars: 3,
      glyphMargin: false,
      overviewRulerBorder: false,
      renderLineHighlight: 'line',
      scrollbar: { useShadows: false },
      contextmenu: false,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      folding: true,
      foldingStrategy: 'indentation',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true
    })

    // Register completion provider after editor is created (needs model)
    registerCompletionProvider()

    // Handle content changes
    editor.onDidChangeModelContent(() => {
      const value = editor?.getValue() || ''
      emit('update:modelValue', value)
    })

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      emit('execute')
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      emit('execute-selected')
    })

    // Format SQL: Shift+Alt+F (standard VS Code shortcut)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      formatCode()
    })

    // Format SQL: Cmd/Ctrl+I
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      formatCode()
    })
  }
})

onUnmounted(() => {
  completionDisposable?.dispose()
  editor?.dispose()
})

// Watch for schema changes to update autocomplete
watch(
  () => props.schema,
  () => {
    registerCompletionProvider()
  },
  { deep: true }
)

// Watch for external value changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue)
    }
  }
)

// Watch for theme changes
watch(editorTheme, (newTheme) => {
  monaco.editor.setTheme(newTheme)
})

// Watch for settings changes
watch(
  () => settingsStore.editorSettings,
  (settings) => {
    if (editor) {
      editor.updateOptions({
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap ? 'on' : 'off',
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers ? 'on' : 'off'
      })
    }
  },
  { deep: true }
)

// Public methods
const getSelectedText = (): string => {
  if (!editor) return ''
  const selection = editor.getSelection()
  if (selection) {
    return editor.getModel()?.getValueInRange(selection) || ''
  }
  return ''
}

const focus = () => {
  editor?.focus()
}

const setValue = (value: string) => {
  editor?.setValue(value)
}

const formatCode = () => {
  if (!editor) return

  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!model) return

  // Check if there's a selection
  if (selection && !selection.isEmpty()) {
    // Format only selected text
    const selectedText = model.getValueInRange(selection)
    const formattedText = formatSql(selectedText, {
      dialect: props.dialect,
      tabWidth: settingsStore.editorSettings.tabSize
    })

    editor.executeEdits('format', [{
      range: selection,
      text: formattedText
    }])
  } else {
    // Format entire document using executeEdits to preserve undo stack
    const value = editor.getValue()
    const formattedValue = formatSql(value, {
      dialect: props.dialect,
      tabWidth: settingsStore.editorSettings.tabSize
    })

    const fullRange = model.getFullModelRange()
    const position = editor.getPosition()
    const totalLines = model.getLineCount()
    const cursorRatio = position ? position.lineNumber / totalLines : 0

    editor.pushUndoStop()
    editor.executeEdits('format', [{
      range: fullRange,
      text: formattedValue
    }])
    editor.pushUndoStop()

    // Restore cursor position
    if (position) {
      const newTotalLines = model.getLineCount()
      const newLine = Math.max(1, Math.round(cursorRatio * newTotalLines))
      editor.setPosition({ lineNumber: newLine, column: 1 })
    }
  }

  emit('format')
}

const getFormattedSql = (): string => {
  if (!editor) return ''
  return formatSql(editor.getValue(), {
    dialect: props.dialect,
    tabWidth: settingsStore.editorSettings.tabSize
  })
}

defineExpose({
  getSelectedText,
  focus,
  setValue,
  formatCode,
  getFormattedSql
})
</script>

<template>
  <div ref="editorRef" class="monaco-editor-container w-full h-full" />
</template>
