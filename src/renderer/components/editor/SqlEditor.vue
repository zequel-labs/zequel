<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'

export interface SchemaMetadata {
  tables: Array<{
    name: string
    columns: Array<{
      name: string
      type: string
    }>
  }>
  views?: Array<{
    name: string
  }>
  procedures?: Array<{
    name: string
  }>
  functions?: Array<{
    name: string
  }>
}

interface Props {
  modelValue: string
  readonly?: boolean
  language?: string
  schema?: SchemaMetadata
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  readonly: false,
  language: 'sql',
  schema: undefined
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

// Store completion provider disposable to update it when schema changes
let completionDisposable: monaco.IDisposable | null = null

function registerCompletionProvider() {
  // Dispose previous provider
  completionDisposable?.dispose()

  completionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      // Get the text before cursor to determine context
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const lineText = model.getLineContent(position.lineNumber)
      const textBeforePosition = lineText.substring(0, position.column - 1)

      const suggestions: monaco.languages.CompletionItem[] = []

      // Check if we're after a table name followed by a dot (for column suggestions)
      const dotMatch = textBeforePosition.match(/(\w+)\.\s*\w*$/i)
      if (dotMatch && props.schema) {
        const tableName = dotMatch[1].toLowerCase()
        const table = props.schema.tables.find(t => t.name.toLowerCase() === tableName)
        if (table) {
          // Suggest columns for this table
          for (const col of table.columns) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: col.type,
              insertText: col.name,
              range
            })
          }
          return { suggestions }
        }
      }

      // Check if we're in a context where table names should be suggested
      const tableContextMatch = textBeforeCursor.match(/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w*)$/i)
      const isTableContext = tableContextMatch !== null

      // Add SQL keywords
      const keywords = [
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
        'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
        'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN',
        'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX',
        'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'NOT NULL',
        'DEFAULT', 'AUTO_INCREMENT', 'CASCADE', 'RESTRICT',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
        'EXISTS', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
        'COALESCE', 'NULLIF', 'CAST', 'CONVERT'
      ]

      // Add keywords with lower priority if in table context
      for (const keyword of keywords) {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
          sortText: isTableContext ? 'z' + keyword : 'a' + keyword
        })
      }

      // Add schema objects if available
      if (props.schema) {
        // Add tables (higher priority in table context)
        for (const table of props.schema.tables) {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: 'Table',
            insertText: table.name,
            range,
            sortText: isTableContext ? 'a' + table.name : 'b' + table.name
          })
        }

        // Add views
        if (props.schema.views) {
          for (const view of props.schema.views) {
            suggestions.push({
              label: view.name,
              kind: monaco.languages.CompletionItemKind.Interface,
              detail: 'View',
              insertText: view.name,
              range,
              sortText: isTableContext ? 'a' + view.name : 'b' + view.name
            })
          }
        }

        // Add procedures
        if (props.schema.procedures) {
          for (const proc of props.schema.procedures) {
            suggestions.push({
              label: proc.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: 'Procedure',
              insertText: proc.name + '()',
              range,
              sortText: 'c' + proc.name
            })
          }
        }

        // Add functions
        if (props.schema.functions) {
          for (const func of props.schema.functions) {
            suggestions.push({
              label: func.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: 'Function',
              insertText: func.name + '()',
              range,
              sortText: 'c' + func.name
            })
          }
        }

        // Add all columns (with table prefix in detail) when not in specific context
        if (!isTableContext && !dotMatch) {
          for (const table of props.schema.tables) {
            for (const col of table.columns) {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                detail: `${table.name}.${col.name} (${col.type})`,
                insertText: col.name,
                range,
                sortText: 'd' + col.name
              })
            }
          }
        }
      }

      return { suggestions }
    }
  })
}

onMounted(() => {
  if (editorRef.value) {
    // Configure Monaco SQL language
    registerCompletionProvider()

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
