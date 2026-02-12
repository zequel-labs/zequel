const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE',
  'SET', 'VALUES', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'ON',
  'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN',
  'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'CASCADE', 'RESTRICT',
  'ADD', 'CONSTRAINT', 'FOREIGN', 'KEY', 'REFERENCES', 'PRIMARY',
  'UNIQUE', 'CHECK', 'DEFAULT', 'EXISTS', 'IF', 'REPLACE',
  'VIEW', 'TRIGGER', 'FUNCTION', 'PROCEDURE', 'RETURN', 'RETURNS',
  'ASC', 'DESC', 'WITH', 'RECURSIVE', 'MATERIALIZED', 'REFRESH',
  'CONCURRENTLY', 'EXPLAIN', 'ANALYZE', 'VACUUM', 'TRUNCATE',
  'GRANT', 'REVOKE', 'SCHEMA', 'DATABASE', 'USE', 'SHOW',
  'TRUE', 'FALSE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE',
  'CAST', 'CONVERT', 'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'LENGTH',
  'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
  'ILIKE', 'SIMILAR', 'TO', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK',
  'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
  'FETCH', 'NEXT', 'ROWS', 'ONLY', 'PERCENT', 'TIES',
  'EXCEPT', 'INTERSECT', 'USING', 'NATURAL',
  'PRAGMA', 'DESCRIBE', 'DO', 'CALL', 'COPY', 'RAISE', 'NOTIFY',
  'LISTEN', 'UNLISTEN', 'PERFORM', 'EXECUTE', 'PREPARE', 'DEALLOCATE',
  'DECLARE', 'CURSOR', 'OPEN', 'CLOSE', 'MOVE',
])

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Lightweight SQL syntax highlighter for the query log panel.
 * Produces HTML with CSS class spans. Much lighter than Monaco's colorize (~5 MB).
 */
export const highlightSql = (sql: string): string => {
  const tokens: string[] = []
  let i = 0

  while (i < sql.length) {
    // Single-line comments
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let end = sql.indexOf('\n', i)
      if (end === -1) end = sql.length
      tokens.push(`<span class="sql-hl-comment">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Multi-line comments
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let end = sql.indexOf('*/', i + 2)
      if (end === -1) end = sql.length
      else end += 2
      tokens.push(`<span class="sql-hl-comment">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Single-quoted strings
    if (sql[i] === "'") {
      let end = i + 1
      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") {
          end += 2
        } else if (sql[end] === "'") {
          end++
          break
        } else {
          end++
        }
      }
      tokens.push(`<span class="sql-hl-string">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Double-quoted identifiers (handles "" escapes)
    if (sql[i] === '"') {
      let end = i + 1
      while (end < sql.length) {
        if (sql[end] === '"' && sql[end + 1] === '"') {
          end += 2
        } else if (sql[end] === '"') {
          end++
          break
        } else {
          end++
        }
      }
      tokens.push(`<span class="sql-hl-identifier">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Backtick-quoted identifiers (MySQL)
    if (sql[i] === '`') {
      let end = sql.indexOf('`', i + 1)
      if (end === -1) end = sql.length
      else end++
      tokens.push(`<span class="sql-hl-identifier">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Numbers
    if (/\d/.test(sql[i]) && (i === 0 || /[\s,()=<>!+\-*/;]/.test(sql[i - 1]))) {
      let end = i
      while (end < sql.length && /[\d.e]/.test(sql[end])) end++
      tokens.push(`<span class="sql-hl-number">${escapeHtml(sql.slice(i, end))}</span>`)
      i = end
      continue
    }

    // Words (keywords or plain identifiers)
    if (/[a-zA-Z_]/.test(sql[i])) {
      let end = i
      while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end])) end++
      const word = sql.slice(i, end)
      if (SQL_KEYWORDS.has(word.toUpperCase())) {
        tokens.push(`<span class="sql-hl-keyword">${escapeHtml(word)}</span>`)
      } else {
        tokens.push(escapeHtml(word))
      }
      i = end
      continue
    }

    // Operators and punctuation
    tokens.push(escapeHtml(sql[i]))
    i++
  }

  return tokens.join('')
}
