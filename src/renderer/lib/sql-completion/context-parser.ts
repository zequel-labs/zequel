import type { SchemaMetadata, SqlContext, SqlContextInfo } from './types'

// Words that should never be treated as table aliases
const ALIAS_RESERVED_WORDS = new Set([
  'on', 'where', 'set', 'inner', 'left', 'right', 'outer', 'cross', 'full',
  'join', 'and', 'or', 'not', 'in', 'order', 'group', 'having', 'limit',
  'offset', 'union', 'intersect', 'except', 'values', 'select', 'from',
  'into', 'using', 'natural', 'lateral'
])

/**
 * Replace string literals and comments with whitespace so that
 * keywords inside strings/comments don't produce false context matches.
 */
export const stripLiteralsAndComments = (sql: string): string => {
  let result = ''
  let i = 0
  while (i < sql.length) {
    // Single-quoted string literal
    if (sql[i] === "'") {
      result += ' '
      i++
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          result += '  '
          i += 2
        } else if (sql[i] === "'") {
          result += ' '
          i++
          break
        } else {
          result += ' '
          i++
        }
      }
      continue
    }

    // Double-quoted identifier (keep as-is — it's an identifier, not a literal)
    if (sql[i] === '"') {
      result += sql[i]
      i++
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          result += sql[i] + sql[i + 1]
          i += 2
        } else if (sql[i] === '"') {
          result += sql[i]
          i++
          break
        } else {
          result += sql[i]
          i++
        }
      }
      continue
    }

    // Line comment --
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        result += ' '
        i++
      }
      continue
    }

    // Block comment /* ... */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      result += '  '
      i += 2
      while (i < sql.length) {
        if (sql[i] === '*' && sql[i + 1] === '/') {
          result += '  '
          i += 2
          break
        }
        result += ' '
        i++
      }
      continue
    }

    result += sql[i]
    i++
  }
  return result
}

/**
 * Find the innermost statement context for the cursor position.
 * If the cursor is inside a subquery (unclosed parenthesis), return only
 * the text after the last unclosed `(` — this prevents an inner FROM from
 * being treated as the outer query's FROM context.
 * If there are no unclosed parens, the full text is returned.
 *
 * Accepts an optional pre-stripped string to avoid redundant stripping.
 */
export const getRelevantContextText = (fullText: string, preStripped?: string): string => {
  const stripped = preStripped ?? stripLiteralsAndComments(fullText)
  let depth = 0
  let lastOpenParen = -1

  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '(') {
      depth++
      lastOpenParen = i
    } else if (stripped[i] === ')') {
      depth--
      if (depth < 0) depth = 0
    }
  }

  if (depth > 0 && lastOpenParen >= 0) {
    // Only strip for actual subquery parens — where the text after `(`
    // starts with a SQL statement keyword. This avoids stripping context
    // for function calls like COALESCE(col, or COUNT(DISTINCT which would
    // lose the outer clause context (e.g. SELECT).
    const afterParen = stripped.substring(lastOpenParen + 1).trimStart()
    const isSubquery = /^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(afterParen)
    if (isSubquery) {
      return fullText.substring(lastOpenParen + 1)
    }
  }
  return fullText
}

/**
 * Extract CTE names from WITH ... AS (...) patterns.
 * Only extracts from the top-level text (not inside subqueries).
 *
 * Accepts an optional pre-stripped string to avoid redundant stripping.
 */
export const extractCteNames = (textBeforeCursor: string, preStripped?: string): string[] => {
  const stripped = preStripped ?? stripLiteralsAndComments(textBeforeCursor)
  const names: string[] = []

  // Match WITH name AS ( or WITH RECURSIVE name AS (
  // and also , name AS ( for chained CTEs
  const ctePattern = /\bWITH\b\s+(?:RECURSIVE\s+)?(\w+)\s+AS\s*\(/gi
  let match = ctePattern.exec(stripped)
  if (match) {
    names.push(match[1])
  }

  // Also match chained CTEs: , name AS (
  const chainedPattern = /,\s*(\w+)\s+AS\s*\(/gi
  while ((match = chainedPattern.exec(stripped)) !== null) {
    names.push(match[1])
  }

  return names
}

/**
 * Parse the SQL text before cursor to determine context, referenced tables,
 * aliases, and CTE names.
 *
 * This inspects FROM/JOIN clauses to extract table references and optional aliases,
 * then determines the current clause context based on the last SQL keyword encountered.
 */
export const getSqlContext = (textBeforeCursor: string): SqlContextInfo => {
  const aliases = new Map<string, string>()
  const tables: string[] = []

  // Strip literals/comments once and reuse across helpers
  const strippedFull = stripLiteralsAndComments(textBeforeCursor)

  // Work on the relevant context (innermost statement)
  const relevantText = getRelevantContextText(textBeforeCursor, strippedFull)
  const cleanText = relevantText === textBeforeCursor
    ? strippedFull
    : stripLiteralsAndComments(relevantText)

  // Extract CTE names from the full text (CTEs are defined at top level)
  const cteNames = extractCteNames(textBeforeCursor, strippedFull)

  // Match FROM/JOIN table references with optional aliases.
  // The alias group uses a negative lookahead to avoid consuming SQL keywords
  // (like JOIN, ON, WHERE) which would prevent subsequent matches from finding them.
  const aliasPattern = /\b(?:FROM|(?:LEFT|RIGHT|INNER|OUTER|CROSS|FULL)?\s*JOIN)\s+(\w+(?:\.\w+)?)(?:\s+(?:AS\s+)?(?!(?:ON|WHERE|SET|INNER|LEFT|RIGHT|OUTER|CROSS|FULL|JOIN|AND|OR|NOT|IN|ORDER|GROUP|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|VALUES|SELECT|FROM|INTO|USING|NATURAL|LATERAL)\b)(\w+))?/gi
  let match
  while ((match = aliasPattern.exec(cleanText)) !== null) {
    const tableName = match[1]
    const alias = match[2]
    tables.push(tableName)
    if (alias && !ALIAS_RESERVED_WORDS.has(alias.toLowerCase())) {
      aliases.set(alias.toLowerCase(), tableName)
    }
  }

  // Determine context from last significant SQL keyword
  const normalised = cleanText.replace(/\s+/g, ' ').trimEnd().toUpperCase()

  let context: SqlContext = 'general'

  // Check from most specific to least specific
  if (/\bON\s+\S*$/i.test(normalised) || /\bON\s+\S+\s*=\s*\S*$/i.test(normalised) || /\bJOIN\s+\w+(?:\s+(?:AS\s+)?\w+)?\s+ON\b/i.test(cleanText)) {
    const afterOn = cleanText.replace(/.*\bON\b/is, '')
    if (!/\b(WHERE|GROUP|ORDER|HAVING|LIMIT|SELECT|FROM|JOIN)\b/i.test(afterOn)) {
      context = 'join_on'
    }
  }

  if (context === 'general') {
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
      if (pattern.test(cleanText)) {
        context = ctx
        break
      }
    }
  }

  return { context, tableAliases: aliases, referencedTables: tables, cteNames }
}

/**
 * Resolve a dot-notation prefix to a table or view.
 * Checks aliases first, then direct table/view names.
 */
export const resolveTableFromPrefix = (
  prefix: string,
  aliases: Map<string, string>,
  schema: SchemaMetadata | undefined
): { name: string; schema?: string; columns: Array<{ name: string; type: string }> } | undefined => {
  if (!schema) return undefined
  const lower = prefix.toLowerCase()

  // Check if prefix is an alias
  const aliasedTable = aliases.get(lower)
  if (aliasedTable) {
    const dotIdx = aliasedTable.indexOf('.')
    if (dotIdx !== -1) {
      const s = aliasedTable.substring(0, dotIdx).toLowerCase()
      const t = aliasedTable.substring(dotIdx + 1).toLowerCase()
      const found = schema.tables.find(
        tbl => tbl.name.toLowerCase() === t && tbl.schema?.toLowerCase() === s
      )
      if (found) return found
      // Also check views
      const view = schema.views?.find(
        v => v.name.toLowerCase() === t && v.schema?.toLowerCase() === s
      )
      if (view?.columns) return { name: view.name, schema: view.schema, columns: view.columns }
      return undefined
    }
    const found = schema.tables.find(t => t.name.toLowerCase() === aliasedTable.toLowerCase())
    if (found) return found
    // Check views
    const view = schema.views?.find(v => v.name.toLowerCase() === aliasedTable.toLowerCase())
    if (view?.columns) return { name: view.name, schema: view.schema, columns: view.columns }
    return undefined
  }

  // Check if prefix is a direct table name
  const table = schema.tables.find(t => t.name.toLowerCase() === lower)
  if (table) return table

  // Check if prefix is a direct view name
  const view = schema.views?.find(v => v.name.toLowerCase() === lower)
  if (view?.columns) return { name: view.name, schema: view.schema, columns: view.columns }

  return undefined
}
