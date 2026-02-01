<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'
import { formatSql, type SqlDialect } from '@/lib/sql-formatter'
import { getSnippetsForDialect, toMonacoSnippet } from '@/lib/sql-snippets'
import { getFunctionsForDialect } from '@/lib/sql-functions'

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
  (e: 'explain'): void
  (e: 'format'): void
}>()

const settingsStore = useSettingsStore()
const { isDark } = useTheme()

const editorRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const editorTheme = computed(() => isDark.value ? 'vs-dark' : 'vs')

// Store completion provider disposable to update it when schema changes
let completionDisposable: monaco.IDisposable | null = null

// --- SQL context analysis helpers ---

type SqlContext = 'select' | 'from' | 'where' | 'join_on' | 'insert_columns' | 'update_set' | 'order_by' | 'group_by' | 'having' | 'general'

interface SqlContextInfo {
  context: SqlContext
  tableAliases: Map<string, string>   // alias (lowercase) -> tableName
  referencedTables: string[]          // table names referenced in FROM/JOIN
}

/**
 * Parse the SQL text before cursor to determine context, referenced tables, and aliases.
 * This inspects FROM/JOIN clauses to extract table references and optional aliases,
 * then determines the current clause context based on the last SQL keyword encountered.
 */
const getSqlContext = (textBeforeCursor: string): SqlContextInfo => {
  const aliases = new Map<string, string>()
  const tables: string[] = []

  // Match FROM/JOIN table references with optional aliases:
  //   FROM users u          -> table=users, alias=u
  //   FROM users AS u       -> table=users, alias=u
  //   JOIN orders o ON ...   -> table=orders, alias=o
  //   LEFT JOIN orders AS o  -> table=orders, alias=o
  //   FROM users             -> table=users, no alias
  const aliasPattern = /\b(?:FROM|(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi
  let match
  while ((match = aliasPattern.exec(textBeforeCursor)) !== null) {
    const tableName = match[1]
    const alias = match[2]
    // Skip SQL keywords that might be falsely captured as aliases
    const reservedWords = new Set([
      'on', 'where', 'set', 'inner', 'left', 'right', 'outer', 'cross', 'full',
      'join', 'and', 'or', 'not', 'in', 'order', 'group', 'having', 'limit',
      'offset', 'union', 'intersect', 'except', 'values', 'select', 'from',
      'into', 'using', 'natural', 'lateral'
    ])
    tables.push(tableName)
    if (alias && !reservedWords.has(alias.toLowerCase())) {
      aliases.set(alias.toLowerCase(), tableName)
    }
  }

  // Determine context from last significant SQL keyword before cursor.
  // We normalise whitespace and search backwards for clause keywords.
  const normalised = textBeforeCursor.replace(/\s+/g, ' ').trimEnd().toUpperCase()

  let context: SqlContext = 'general'

  // Check from most specific to least specific
  if (/\bON\s+\S*$/i.test(normalised) || /\bON\s+\S+\s*=\s*\S*$/i.test(normalised) || /\bJOIN\s+\w+(?:\s+(?:AS\s+)?\w+)?\s+ON\b/i.test(textBeforeCursor)) {
    // We are inside a JOIN ON clause
    const afterOn = textBeforeCursor.replace(/.*\bON\b/is, '')
    // Only consider it join_on if we haven't moved on to another clause
    if (!/\b(WHERE|GROUP|ORDER|HAVING|LIMIT|SELECT|FROM|JOIN)\b/i.test(afterOn)) {
      context = 'join_on'
    }
  }

  if (context === 'general') {
    // Walk backwards through known clause keywords to find the current one
    const clausePatterns: Array<{ pattern: RegExp; ctx: SqlContext }> = [
      { pattern: /\bSELECT\b(?!.*\b(?:FROM|WHERE|JOIN|ON|SET|INTO|ORDER|GROUP|HAVING)\b)/is, ctx: 'select' },
      { pattern: /\bFROM\b(?!.*\b(?:WHERE|JOIN|ON|SET|ORDER|GROUP|HAVING|SELECT)\b)/is, ctx: 'from' },
      { pattern: /\bWHERE\b(?!.*\b(?:ORDER|GROUP|HAVING|LIMIT)\b)/is, ctx: 'where' },
      { pattern: /\bSET\b(?!.*\b(?:WHERE|ORDER|LIMIT)\b)/is, ctx: 'update_set' },
      { pattern: /\bINSERT\s+INTO\s+\w+\s*\((?!.*\))/is, ctx: 'insert_columns' },
      { pattern: /\bORDER\s+BY\b(?!.*\b(?:LIMIT|OFFSET)\b)/is, ctx: 'order_by' },
      { pattern: /\bGROUP\s+BY\b(?!.*\b(?:HAVING|ORDER|LIMIT)\b)/is, ctx: 'group_by' },
      { pattern: /\bHAVING\b(?!.*\b(?:ORDER|LIMIT)\b)/is, ctx: 'having' },
    ]

    for (const { pattern, ctx } of clausePatterns) {
      if (pattern.test(textBeforeCursor)) {
        context = ctx
        break
      }
    }
  }

  return { context, tableAliases: aliases, referencedTables: tables }
}

/**
 * Resolve a dot-notation prefix to a table name.
 * Checks aliases first, then direct table names.
 */
const resolveTableFromPrefix = (
  prefix: string,
  aliases: Map<string, string>,
  schema: SchemaMetadata | undefined
): { name: string; columns: Array<{ name: string; type: string }> } | undefined => {
  if (!schema) return undefined
  const lower = prefix.toLowerCase()

  // Check if prefix is an alias
  const aliasedTable = aliases.get(lower)
  if (aliasedTable) {
    return schema.tables.find(t => t.name.toLowerCase() === aliasedTable.toLowerCase())
  }

  // Check if prefix is a direct table name
  return schema.tables.find(t => t.name.toLowerCase() === lower)
}

const registerCompletionProvider = () => {
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

      // Get the full text before cursor (across all lines) for context analysis
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const lineText = model.getLineContent(position.lineNumber)
      const textBeforePosition = lineText.substring(0, position.column - 1)

      const suggestions: monaco.languages.CompletionItem[] = []
      const seenLabels = new Set<string>()

      // Helper to add a suggestion only if not already present (deduplication)
      const addSuggestion = (item: monaco.languages.CompletionItem) => {
        const key = `${item.label}::${item.kind}`
        if (!seenLabels.has(key)) {
          seenLabels.add(key)
          suggestions.push(item)
        }
      }

      // Analyse SQL context: which clause we are in, aliases, referenced tables
      const { context, tableAliases, referencedTables } = getSqlContext(textBeforeCursor)

      // ─── DOT NOTATION: alias.col or table.col ───
      const dotMatch = textBeforePosition.match(/(\w+)\.\s*\w*$/i)
      if (dotMatch && props.schema) {
        const prefix = dotMatch[1]
        const resolvedTable = resolveTableFromPrefix(prefix, tableAliases, props.schema)
        if (resolvedTable) {
          for (const col of resolvedTable.columns) {
            addSuggestion({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${resolvedTable.name}.${col.name} (${col.type})`,
              insertText: col.name,
              range,
              sortText: 'a' + col.name
            })
          }
          return { suggestions }
        }
      }

      // ─── TABLE CONTEXT (FROM, JOIN, INTO, UPDATE, TABLE) ───
      const tableContextMatch = textBeforeCursor.match(/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w*)$/i)
      const isTableContext = tableContextMatch !== null

      // ─── SQL KEYWORDS ───
      const keywords = [
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
        'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
        'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN',
        'ON', 'AS', 'DISTINCT',
        'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX',
        'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'NOT NULL',
        'DEFAULT', 'AUTO_INCREMENT', 'CASCADE', 'RESTRICT',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
        'EXISTS', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
        'COALESCE', 'NULLIF', 'CAST', 'CONVERT'
      ]

      for (const keyword of keywords) {
        addSuggestion({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
          sortText: isTableContext ? 'z' + keyword : 'b' + keyword
        })
      }

      // ─── SCHEMA OBJECTS ───
      if (props.schema) {
        // Tables (higher priority in FROM/JOIN context)
        for (const table of props.schema.tables) {
          addSuggestion({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: 'Table',
            insertText: table.name,
            range,
            sortText: isTableContext ? 'a' + table.name : 'c' + table.name
          })
        }

        // Views
        if (props.schema.views) {
          for (const view of props.schema.views) {
            addSuggestion({
              label: view.name,
              kind: monaco.languages.CompletionItemKind.Interface,
              detail: 'View',
              insertText: view.name,
              range,
              sortText: isTableContext ? 'a' + view.name : 'c' + view.name
            })
          }
        }

        // Procedures
        if (props.schema.procedures) {
          for (const proc of props.schema.procedures) {
            addSuggestion({
              label: proc.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: 'Procedure',
              insertText: proc.name + '()',
              range,
              sortText: 'd' + proc.name
            })
          }
        }

        // Schema-defined functions
        if (props.schema.functions) {
          for (const func of props.schema.functions) {
            addSuggestion({
              label: func.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: 'Function',
              insertText: func.name + '()',
              range,
              sortText: 'd' + func.name
            })
          }
        }

        // ─── SMART COLUMN SUGGESTIONS based on context ───
        const isColumnContext = (
          context === 'select' ||
          context === 'where' ||
          context === 'order_by' ||
          context === 'group_by' ||
          context === 'having' ||
          context === 'update_set' ||
          context === 'insert_columns'
        )

        if (!isTableContext && !dotMatch) {
          if (isColumnContext && referencedTables.length > 0) {
            // When we know which tables are in the query, suggest their columns with high priority
            const addedColumns = new Set<string>()
            for (const tableName of referencedTables) {
              const table = props.schema.tables.find(
                t => t.name.toLowerCase() === tableName.toLowerCase()
              )
              if (table) {
                for (const col of table.columns) {
                  // If same column name exists in multiple tables, include table prefix in label
                  const colKey = col.name.toLowerCase()
                  if (addedColumns.has(colKey)) {
                    // Add the table-qualified variant
                    addSuggestion({
                      label: `${table.name}.${col.name}`,
                      kind: monaco.languages.CompletionItemKind.Field,
                      detail: `${table.name}.${col.name} (${col.type})`,
                      insertText: `${table.name}.${col.name}`,
                      range,
                      sortText: 'a1' + col.name
                    })
                  } else {
                    addedColumns.add(colKey)
                    addSuggestion({
                      label: col.name,
                      kind: monaco.languages.CompletionItemKind.Field,
                      detail: `${table.name}.${col.name} (${col.type})`,
                      insertText: col.name,
                      range,
                      sortText: 'a0' + col.name
                    })
                  }
                }
              }
            }
          } else {
            // Fallback: suggest all columns from all tables with lower priority
            for (const table of props.schema.tables) {
              for (const col of table.columns) {
                addSuggestion({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: `${table.name}.${col.name} (${col.type})`,
                  insertText: col.name,
                  range,
                  sortText: 'e' + col.name
                })
              }
            }
          }
        }

        // ─── JOIN ON SUGGESTIONS ───
        if (context === 'join_on' && referencedTables.length >= 2) {
          // Suggest likely join conditions based on column name patterns.
          // Looks for id/foreign-key naming conventions like:
          //   users.id = orders.user_id
          //   orders.product_id = products.id
          const lastJoinedTable = referencedTables[referencedTables.length - 1]
          const lastTable = props.schema.tables.find(
            t => t.name.toLowerCase() === lastJoinedTable.toLowerCase()
          )

          if (lastTable) {
            // Find the alias or name to use for the last joined table
            let lastTableRef = lastJoinedTable
            for (const [alias, tName] of tableAliases.entries()) {
              if (tName.toLowerCase() === lastJoinedTable.toLowerCase()) {
                lastTableRef = alias
                break
              }
            }

            // Check other referenced tables for FK-like matches
            for (let i = 0; i < referencedTables.length - 1; i++) {
              const otherTableName = referencedTables[i]
              const otherTable = props.schema.tables.find(
                t => t.name.toLowerCase() === otherTableName.toLowerCase()
              )
              if (!otherTable) continue

              // Find alias or name for the other table
              let otherTableRef = otherTableName
              for (const [alias, tName] of tableAliases.entries()) {
                if (tName.toLowerCase() === otherTableName.toLowerCase()) {
                  otherTableRef = alias
                  break
                }
              }

              // Pattern 1: lastTable has <otherTable_singular>_id matching otherTable.id
              // e.g., orders.user_id = users.id
              const singularOther = otherTableName.replace(/s$/i, '')
              const fkCol = lastTable.columns.find(
                c => c.name.toLowerCase() === `${singularOther.toLowerCase()}_id`
              )
              const pkCol = otherTable.columns.find(
                c => c.name.toLowerCase() === 'id'
              )
              if (fkCol && pkCol) {
                const joinText = `${lastTableRef}.${fkCol.name} = ${otherTableRef}.${pkCol.name}`
                addSuggestion({
                  label: joinText,
                  kind: monaco.languages.CompletionItemKind.Value,
                  detail: 'Join condition (FK pattern)',
                  documentation: `Join ${lastJoinedTable} to ${otherTableName} on foreign key`,
                  insertText: joinText,
                  range,
                  sortText: 'a0' + joinText
                })
              }

              // Pattern 2: otherTable has <lastTable_singular>_id matching lastTable.id
              // e.g., users.order_id = orders.id (reverse)
              const singularLast = lastJoinedTable.replace(/s$/i, '')
              const reverseFkCol = otherTable.columns.find(
                c => c.name.toLowerCase() === `${singularLast.toLowerCase()}_id`
              )
              const reversePkCol = lastTable.columns.find(
                c => c.name.toLowerCase() === 'id'
              )
              if (reverseFkCol && reversePkCol) {
                const joinText = `${lastTableRef}.${reversePkCol.name} = ${otherTableRef}.${reverseFkCol.name}`
                addSuggestion({
                  label: joinText,
                  kind: monaco.languages.CompletionItemKind.Value,
                  detail: 'Join condition (FK pattern)',
                  documentation: `Join ${lastJoinedTable} to ${otherTableName} on foreign key`,
                  insertText: joinText,
                  range,
                  sortText: 'a0' + joinText
                })
              }

              // Pattern 3: matching column names (e.g., both have "id" or "email")
              for (const lastCol of lastTable.columns) {
                for (const otherCol of otherTable.columns) {
                  if (
                    lastCol.name.toLowerCase() === otherCol.name.toLowerCase() &&
                    lastCol.name.toLowerCase() !== 'id' && // skip bare id=id
                    lastCol.name.toLowerCase() !== 'created_at' &&
                    lastCol.name.toLowerCase() !== 'updated_at'
                  ) {
                    const joinText = `${lastTableRef}.${lastCol.name} = ${otherTableRef}.${otherCol.name}`
                    addSuggestion({
                      label: joinText,
                      kind: monaco.languages.CompletionItemKind.Value,
                      detail: 'Join condition (matching columns)',
                      documentation: `Join on common column "${lastCol.name}"`,
                      insertText: joinText,
                      range,
                      sortText: 'a1' + joinText
                    })
                  }
                }
              }
            }

            // Always suggest individual columns from the joined table for manual ON building
            for (const col of lastTable.columns) {
              addSuggestion({
                label: `${lastTableRef}.${col.name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                detail: `${lastJoinedTable}.${col.name} (${col.type})`,
                insertText: `${lastTableRef}.${col.name}`,
                range,
                sortText: 'a2' + col.name
              })
            }
          }
        }

        // ─── ALIAS SUGGESTIONS ───
        // If there are aliases in the query, suggest them so the user can type alias.
        if (tableAliases.size > 0 && !dotMatch && !isTableContext) {
          for (const [alias, tableName] of tableAliases.entries()) {
            addSuggestion({
              label: alias,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: `Alias for ${tableName}`,
              insertText: alias,
              range,
              sortText: 'a' + alias
            })
          }
        }
      }

      // ─── DATABASE-SPECIFIC FUNCTION SUGGESTIONS ───
      const dialectFunctions = getFunctionsForDialect(props.dialect)
      for (const fn of dialectFunctions) {
        addSuggestion({
          label: fn.name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: fn.signature,
          documentation: `${fn.description} [${fn.category}]`,
          insertText: fn.name + '($0)',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: 'd' + fn.name
        })
      }

      // ─── SQL SNIPPETS ───
      const snippets = getSnippetsForDialect(props.dialect)
      for (const snippet of snippets) {
        addSuggestion({
          label: snippet.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: snippet.name,
          documentation: snippet.description,
          insertText: toMonacoSnippet(snippet),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: 'f' + snippet.prefix
        })
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

    // Explain Query: Cmd/Ctrl+Shift+E
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => {
      emit('explain')
    })

    // Format SQL: Shift+Alt+F (standard VS Code shortcut)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
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
    // Format entire document
    const value = editor.getValue()
    const formattedValue = formatSql(value, {
      dialect: props.dialect,
      tabWidth: settingsStore.editorSettings.tabSize
    })

    // Preserve cursor position ratio
    const position = editor.getPosition()
    const totalLines = model.getLineCount()
    const cursorRatio = position ? position.lineNumber / totalLines : 0

    editor.setValue(formattedValue)

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
