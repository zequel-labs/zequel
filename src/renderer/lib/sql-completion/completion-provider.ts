import * as monaco from 'monaco-editor'
import type { SchemaMetadata } from './types'
import type { SqlDialect } from '@/lib/sql-formatter'
import { getSqlContext, resolveTableFromPrefix } from './context-parser'
import { SQL_KEYWORDS } from './sql-keywords'
import { quoteIdentifier, needsQuoting } from './identifier-quoting'
import { getFunctionsForDialect } from '@/lib/sql-functions'
import { getSnippetsForDialect, toMonacoSnippet } from '@/lib/sql-snippets'

/**
 * Build a Monaco `provideCompletionItems` handler scoped to a specific editor model.
 * Returning early when `model !== editorModel` prevents cross-editor suggestion leaks
 * that arise because `registerCompletionItemProvider('sql', ...)` is global.
 */
export const buildProvideCompletionItems = (
  editorModel: monaco.editor.ITextModel,
  schema: SchemaMetadata | undefined,
  dialect: SqlDialect
): monaco.languages.CompletionItemProvider['provideCompletionItems'] => {

  return (model, position) => {
    // Instance guard — only provide suggestions for our own editor
    if (model !== editorModel) {
      return { suggestions: [] }
    }

    const word = model.getWordUntilPosition(position)
    const range: monaco.IRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    }

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

    const addSuggestion = (item: monaco.languages.CompletionItem): void => {
      const key = `${item.label}::${item.kind}`
      if (!seenLabels.has(key)) {
        seenLabels.add(key)
        suggestions.push(item)
      }
    }

    const qi = (name: string): string => quoteIdentifier(name, dialect)

    /** Build a possibly-quoted insert text for a schema-qualified object. */
    const buildSchemaQualifiedInsert = (name: string, schemaName?: string): string => {
      if (schemaName) {
        const quotedSchema = needsQuoting(schemaName) ? qi(schemaName) : schemaName
        const quotedName = needsQuoting(name) ? qi(name) : name
        return `${quotedSchema}.${quotedName}`
      }
      return needsQuoting(name) ? qi(name) : name
    }

    const { context, tableAliases, referencedTables, cteNames } = getSqlContext(textBeforeCursor)

    /**
     * Find a table in schema by a possibly schema-qualified name (e.g. "public.posts" or "posts").
     */
    const findTable = (name: string) => {
      if (!schema) return undefined
      const dotIdx = name.indexOf('.')
      if (dotIdx !== -1) {
        const s = name.substring(0, dotIdx).toLowerCase()
        const t = name.substring(dotIdx + 1).toLowerCase()
        return schema.tables.find(
          tbl => tbl.name.toLowerCase() === t && tbl.schema?.toLowerCase() === s
        )
      }
      return schema.tables.find(t => t.name.toLowerCase() === name.toLowerCase())
    }

    /**
     * Find a view in schema by a possibly schema-qualified name.
     */
    const findView = (name: string) => {
      if (!schema?.views) return undefined
      const dotIdx = name.indexOf('.')
      if (dotIdx !== -1) {
        const s = name.substring(0, dotIdx).toLowerCase()
        const v = name.substring(dotIdx + 1).toLowerCase()
        return schema.views.find(
          view => view.name.toLowerCase() === v && view.schema?.toLowerCase() === s
        )
      }
      return schema.views.find(v => v.name.toLowerCase() === name.toLowerCase())
    }

    /** Extract just the table name part from a possibly schema-qualified name. */
    const bareTableName = (name: string): string => {
      const dotIdx = name.indexOf('.')
      return dotIdx !== -1 ? name.substring(dotIdx + 1) : name
    }

    // ─── DOT NOTATION: schema.table, alias.col, or table.col ───
    const dotMatch = textBeforePosition.match(/(\w+)\.\s*\w*$/i)
    if (dotMatch && schema) {
      const prefix = dotMatch[1]

      // Check if prefix is a schema name — suggest tables in that schema
      const schemaNames = new Set(
        schema.tables.map(t => t.schema?.toLowerCase()).filter((s): s is string => !!s)
      )
      const prefixLower = prefix.toLowerCase()
      if (schemaNames.has(prefixLower)) {
        for (const table of schema.tables) {
          if (table.schema?.toLowerCase() === prefixLower) {
            const insertText = needsQuoting(table.name) ? qi(table.name) : table.name
            addSuggestion({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              detail: `${prefix}.${table.name}`,
              insertText,
              range,
              sortText: 'a' + table.name
            })
          }
        }
        if (schema.views) {
          for (const view of schema.views) {
            if (view.schema?.toLowerCase() === prefixLower) {
              const insertText = needsQuoting(view.name) ? qi(view.name) : view.name
              addSuggestion({
                label: view.name,
                kind: monaco.languages.CompletionItemKind.Interface,
                detail: `${prefix}.${view.name}`,
                insertText,
                range,
                sortText: 'a' + view.name
              })
            }
          }
        }
        return { suggestions }
      }

      const resolvedTable = resolveTableFromPrefix(prefix, tableAliases, schema)
      if (resolvedTable) {
        for (const col of resolvedTable.columns) {
          const insertText = needsQuoting(col.name) ? qi(col.name) : col.name
          addSuggestion({
            label: col.name,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: `${resolvedTable.name}.${col.name} (${col.type})`,
            insertText,
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

    // ─── OPERATOR CONTEXT (WHERE col |, HAVING col |) ───
    // After a column name in WHERE/HAVING, the user likely wants a comparison operator.
    const OPERATOR_SKIP_WORDS = new Set([
      'AND', 'OR', 'NOT', 'WHERE', 'HAVING', 'SELECT', 'FROM', 'SET',
      'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'IS', 'THEN', 'ELSE', 'WHEN',
      'CASE', 'END', 'AS', 'ON', 'NULL', 'TRUE', 'FALSE', 'EXISTS',
      'ALL', 'ANY', 'SOME', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
      'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL',
      'GROUP', 'ORDER', 'UNION', 'INTERSECT', 'EXCEPT', 'SIMILAR', 'TO',
    ])
    const VALUE_EXPECTING_TOKENS = new Set([
      '=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'ILIKE',
      'BETWEEN', 'THEN', 'ELSE', 'WHEN',
    ])

    let isOperatorContext = false
    if (context === 'where' || context === 'having') {
      const trailingWord = textBeforePosition.match(/\b(\w+)\s+$/)
      if (trailingWord) {
        const lastWord = trailingWord[1].toUpperCase()
        if (!OPERATOR_SKIP_WORDS.has(lastWord)) {
          // Check whether the word before the last word is a value-expecting token
          const precedingMatch = textBeforePosition.match(/(\S+)\s+\w+\s+$/)
          const preceding = precedingMatch?.[1]?.toUpperCase() ?? ''
          if (!VALUE_EXPECTING_TOKENS.has(preceding)) {
            isOperatorContext = true
          }
        }
      }
    }

    if (isOperatorContext) {
      const operators: Array<{ label: string; detail: string; insertText?: string }> = [
        { label: '=', detail: 'Equal to' },
        { label: '!=', detail: 'Not equal to' },
        { label: '<>', detail: 'Not equal to (SQL standard)' },
        { label: '>', detail: 'Greater than' },
        { label: '<', detail: 'Less than' },
        { label: '>=', detail: 'Greater than or equal' },
        { label: '<=', detail: 'Less than or equal' },
        { label: 'LIKE', detail: 'Pattern match (% and _)' },
        { label: 'NOT LIKE', detail: 'Negated pattern match' },
        { label: 'ILIKE', detail: 'Case-insensitive pattern match' },
        { label: 'IN (', detail: 'In a set of values', insertText: 'IN ($0)' },
        { label: 'NOT IN (', detail: 'Not in a set of values', insertText: 'NOT IN ($0)' },
        { label: 'IS NULL', detail: 'Is null' },
        { label: 'IS NOT NULL', detail: 'Is not null' },
        { label: 'BETWEEN', detail: 'Between two values' },
        { label: 'NOT BETWEEN', detail: 'Not between two values' },
      ]
      for (const op of operators) {
        const isSnippet = op.insertText !== undefined
        addSuggestion({
          label: op.label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: op.detail,
          insertText: op.insertText ?? op.label,
          ...(isSnippet ? { insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet } : {}),
          range,
          sortText: 'a0' + op.label
        })
      }
    }

    // ─── SQL KEYWORDS ───
    for (const keyword of SQL_KEYWORDS) {
      addSuggestion({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
        sortText: isTableContext ? 'z' + keyword : (isOperatorContext ? 'c' + keyword : 'b' + keyword)
      })
    }

    // ─── SCHEMA OBJECTS ───
    if (schema) {
      // Schema names
      const schemaNames = new Set(
        schema.tables.map(t => t.schema).filter((s): s is string => !!s)
      )
      const hasMultipleSchemas = schemaNames.size > 1

      if (hasMultipleSchemas) {
        for (const schemaName of schemaNames) {
          addSuggestion({
            label: schemaName,
            kind: monaco.languages.CompletionItemKind.Module,
            detail: 'Schema',
            insertText: schemaName,
            range,
            sortText: isTableContext ? 'a0' + schemaName : 'c0' + schemaName
          })
        }
      }

      // Tables
      for (const table of schema.tables) {
        const label = table.schema ? `${table.schema}.${table.name}` : table.name
        addSuggestion({
          label,
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'Table',
          insertText: buildSchemaQualifiedInsert(table.name, table.schema),
          range,
          sortText: isTableContext ? 'a1' + table.name : 'c1' + table.name
        })
      }

      // Views
      if (schema.views) {
        for (const view of schema.views) {
          const label = view.schema ? `${view.schema}.${view.name}` : view.name
          addSuggestion({
            label,
            kind: monaco.languages.CompletionItemKind.Interface,
            detail: 'View',
            insertText: buildSchemaQualifiedInsert(view.name, view.schema),
            range,
            sortText: isTableContext ? 'a1' + view.name : 'c1' + view.name
          })
        }
      }

      // CTE names as table suggestions
      if (cteNames.length > 0 && (isTableContext || context === 'from')) {
        for (const cteName of cteNames) {
          addSuggestion({
            label: cteName,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: 'CTE',
            insertText: cteName,
            range,
            sortText: isTableContext ? 'a0' + cteName : 'c0' + cteName
          })
        }
      }

      // Procedures
      if (schema.procedures) {
        for (const proc of schema.procedures) {
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
      if (schema.functions) {
        for (const func of schema.functions) {
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
          const addedColumns = new Set<string>()
          for (const tableName of referencedTables) {
            // Check tables (handles schema-qualified names like "public.posts")
            const table = findTable(tableName)
            // Also check views for column suggestions
            const view = !table ? findView(tableName) : undefined
            const columns = table?.columns ?? view?.columns
            const resolvedName = table?.name ?? view?.name ?? bareTableName(tableName)

            if (columns) {
              for (const col of columns) {
                const colKey = col.name.toLowerCase()
                const insertText = needsQuoting(col.name) ? qi(col.name) : col.name
                const colSort = isOperatorContext ? 'b' : 'a'
                if (addedColumns.has(colKey)) {
                  addSuggestion({
                    label: `${resolvedName}.${col.name}`,
                    kind: monaco.languages.CompletionItemKind.Field,
                    detail: `${resolvedName}.${col.name} (${col.type})`,
                    insertText: `${resolvedName}.${insertText}`,
                    range,
                    sortText: colSort + '1' + col.name
                  })
                } else {
                  addedColumns.add(colKey)
                  addSuggestion({
                    label: col.name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    detail: `${resolvedName}.${col.name} (${col.type})`,
                    insertText,
                    range,
                    sortText: colSort + '0' + col.name
                  })
                }
              }
            }
          }
        } else {
          // Fallback: suggest all columns from all tables (and views with columns)
          for (const table of schema.tables) {
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
          if (schema.views) {
            for (const view of schema.views) {
              if (view.columns) {
                for (const col of view.columns) {
                  addSuggestion({
                    label: col.name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    detail: `${view.name}.${col.name} (${col.type})`,
                    insertText: col.name,
                    range,
                    sortText: 'e' + col.name
                  })
                }
              }
            }
          }
        }
      }

      // ─── JOIN ON SUGGESTIONS ───
      if (context === 'join_on' && referencedTables.length >= 2) {
        const lastJoinedTable = referencedTables[referencedTables.length - 1]
        const lastTable = findTable(lastJoinedTable)

        if (lastTable) {
          let lastTableRef = lastJoinedTable
          for (const [alias, tName] of tableAliases.entries()) {
            if (tName.toLowerCase() === lastJoinedTable.toLowerCase()) {
              lastTableRef = alias
              break
            }
          }

          for (let i = 0; i < referencedTables.length - 1; i++) {
            const otherTableName = referencedTables[i]
            const otherTable = findTable(otherTableName)
            if (!otherTable) continue

            let otherTableRef = otherTableName
            for (const [alias, tName] of tableAliases.entries()) {
              if (tName.toLowerCase() === otherTableName.toLowerCase()) {
                otherTableRef = alias
                break
              }
            }

            // Pattern 1: lastTable has <otherTable_singular>_id matching otherTable.id
            const singularOther = bareTableName(otherTableName).replace(/s$/i, '')
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

            // Pattern 2: reverse FK
            const singularLast = bareTableName(lastJoinedTable).replace(/s$/i, '')
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

            // Pattern 3: matching column names
            for (const lastCol of lastTable.columns) {
              for (const otherCol of otherTable.columns) {
                if (
                  lastCol.name.toLowerCase() === otherCol.name.toLowerCase() &&
                  lastCol.name.toLowerCase() !== 'id' &&
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

          // Individual columns from the joined table
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
    const dialectFunctions = getFunctionsForDialect(dialect)
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
    const snippets = getSnippetsForDialect(dialect)
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
}
