import { describe, it, expect } from 'vitest'
import { streamSqlStatements } from '@main/services/backup/native/sql-stream'
const split = async (text: string, size: number): Promise<string[]> => {
  const chunks = async function* (): AsyncGenerator<string> { for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size) }
  const result: string[] = []
  for await (const statement of streamSqlStatements(chunks())) result.push(statement)
  return result
}
describe('incremental SQL statements', () => {
  it.each([1, 2, 3, 7, 1024])('preserves strings, escapes, identifiers and comments across %s-byte chunks', async size => {
    const first = "INSERT INTO `a;b` VALUES ('one;two', 'O''Reilly', 'escaped\\\'quote')"
    const second = '/* outer /* inner; */ end */ SELECT 2'
    expect(await split(first + ';\n' + second + ';', size)).toEqual([first, second])
  })
  it('rejects unterminated input', async () => {
    await expect(split("INSERT INTO t VALUES ('broken", 3)).rejects.toThrow('Incomplete')
  })
})
