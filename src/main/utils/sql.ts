/**
 * Split a SQL string into individual statements on top-level semicolons, correctly
 * ignoring semicolons inside single/double/backtick quotes, line/block comments, and
 * PostgreSQL dollar-quoted strings. Pure utility — no Electron/IPC dependencies — so it
 * can be reused by both the IPC query layer and the backup serializers.
 */
export const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = []
  let current = ''
  let i = 0
  const len = sql.length

  while (i < len) {
    const ch = sql[i]

    // Single-quoted string
    if (ch === "'") {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === "'" && i + 1 < len && sql[i + 1] === "'") {
          // Escaped single quote ('')
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Double-quoted identifier
    if (ch === '"') {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === '"' && i + 1 < len && sql[i + 1] === '"') {
          // Escaped double quote ("")
          current += '""'
          i += 2
        } else if (sql[i] === '"') {
          current += '"'
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Backtick-quoted identifier
    if (ch === '`') {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === '`' && i + 1 < len && sql[i + 1] === '`') {
          // Escaped backtick (``)
          current += '``'
          i += 2
        } else if (sql[i] === '`') {
          current += '`'
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Line comment (--)
    if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
      current += '--'
      i += 2
      while (i < len && sql[i] !== '\n') {
        current += sql[i]
        i++
      }
      continue
    }

    // Block comment (/* ... */)
    if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
      current += '/*'
      i += 2
      while (i < len) {
        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          current += '*/'
          i += 2
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // PostgreSQL dollar-quoted string ($tag$...$tag$ or $$...$$)
    if (ch === '$') {
      const tagMatch = sql.substring(i).match(/^\$([A-Za-z_][\w]*)?\$/)
      if (tagMatch) {
        const tag = tagMatch[0] // e.g. "$$" or "$tag$"
        current += tag
        i += tag.length
        const endPos = sql.indexOf(tag, i)
        if (endPos !== -1) {
          current += sql.substring(i, endPos + tag.length)
          i = endPos + tag.length
        } else {
          // No closing tag found — consume rest of input
          current += sql.substring(i)
          i = len
        }
        continue
      }
    }

    // Semicolon: statement boundary
    if (ch === ';') {
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      i++
      continue
    }

    // Normal character
    current += ch
    i++
  }

  // Don't forget the last statement (may not end with semicolon)
  const trimmed = current.trim()
  if (trimmed) {
    statements.push(trimmed)
  }

  return statements
}
