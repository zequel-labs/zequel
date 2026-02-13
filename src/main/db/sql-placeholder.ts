/** Replace `?` placeholders with `@p0, @p1, …`, correctly skipping quoted strings (including `''` escapes) and comments. */
export const replacePlaceholders = (sql: string): string => {
  let paramIndex = 0
  let result = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === "'") {
      // Walk through a single-quoted string, handling '' escapes
      result += ch
      i++
      while (i < sql.length) {
        result += sql[i]
        if (sql[i] === "'" && sql[i + 1] === "'") {
          result += sql[i + 1]
          i += 2
        } else if (sql[i] === "'") {
          i++
          break
        } else {
          i++
        }
      }
    } else if (ch === '-' && sql[i + 1] === '-') {
      // Line comment — skip to end of line
      while (i < sql.length && sql[i] !== '\n') {
        result += sql[i]
        i++
      }
    } else if (ch === '/' && sql[i + 1] === '*') {
      // Block comment — skip to */
      result += ch
      i++
      while (i < sql.length) {
        result += sql[i]
        if (sql[i] === '*' && sql[i + 1] === '/') {
          result += sql[i + 1]
          i += 2
          break
        }
        i++
      }
    } else if (ch === '?') {
      result += `@p${paramIndex++}`
      i++
    } else {
      result += ch
      i++
    }
  }
  return result
}
