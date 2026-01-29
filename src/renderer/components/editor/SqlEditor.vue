<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'

interface Props {
  modelValue: string
  readonly?: boolean
  language?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  readonly: false,
  language: 'sql'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'execute'): void
  (e: 'execute-selected'): void
}>()

const settingsStore = useSettingsStore()
const { isDark } = useTheme()

const editorRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const editorTheme = computed(() => isDark.value ? 'vs-dark' : 'vs')

onMounted(() => {
  if (editorRef.value) {
    // Configure Monaco SQL language
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
          'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
          'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
          'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
          'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
          'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX',
          'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'NOT NULL',
          'DEFAULT', 'AUTO_INCREMENT', 'CASCADE', 'RESTRICT'
        ]

        const suggestions = keywords.map(keyword => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range
        }))

        return { suggestions }
      }
    })

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
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      folding: true,
      foldingStrategy: 'indentation',
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true
    })

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
  }
})

onUnmounted(() => {
  editor?.dispose()
})

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
function getSelectedText(): string {
  if (!editor) return ''
  const selection = editor.getSelection()
  if (selection) {
    return editor.getModel()?.getValueInRange(selection) || ''
  }
  return ''
}

function focus() {
  editor?.focus()
}

function setValue(value: string) {
  editor?.setValue(value)
}

defineExpose({
  getSelectedText,
  focus,
  setValue
})
</script>

<template>
  <div ref="editorRef" class="monaco-editor-container w-full h-full" />
</template>
