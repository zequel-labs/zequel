/** Incremental SQL framing for ClickHouse dumps. Keeps at most one statement in memory. */
export const streamSqlStatements = async function* (chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = ''
  let position = 0
  let quote = ''
  let lineComment = false
  let blockDepth = 0
  for await (const chunk of chunks) {
    buffer += chunk
    let start = 0
    // Keep a lookahead character between chunks for escaped quotes/comment delimiters.
    while (position < buffer.length - 1) {
      const ch = buffer[position]
      const next = buffer[position + 1]
      if (lineComment) {
        if (ch === '\n') lineComment = false
      } else if (blockDepth) {
        if (ch === '/' && next === '*') { blockDepth++; position++ }
        else if (ch === '*' && next === '/') { blockDepth--; position++ }
      } else if (quote) {
        if (ch === '\\') position++
        else if (ch === quote) {
          if (next === quote) position++
          else quote = ''
        }
      } else if (ch === '-' && next === '-') { lineComment = true; position++ }
      else if (ch === '/' && next === '*') { blockDepth++; position++ }
      else if (ch === "'" || ch === '"' || ch === '`') quote = ch
      else if (ch === ';') {
        const statement = buffer.slice(start, position).trim()
        if (statement) yield statement
        start = position + 1
      }
      position++
    }
    buffer = buffer.slice(start)
    position -= start
  }
  const last = buffer[position]
  if (quote && last === quote) quote = ''
  if (quote || blockDepth) throw new Error('Incomplete SQL statement in backup')
  const statement = buffer.trim().replace(/;$/, '').trim()
  if (statement) yield statement
}
