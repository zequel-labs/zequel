import type { ClickHouseDriver } from '@main/db/clickhouse'
import { splitSqlStatements } from '@main/utils/sql'
import { logger } from '@main/utils/logger'

/**
 * Serialize selected ClickHouse tables (or the whole database) into a restorable SQL
 * document: a `CREATE TABLE` statement per table followed by `INSERT` statements that
 * ClickHouse itself generates via the `SQLInsert` output format (no hand-rolled value
 * escaping). Runs over the HTTP interface, so it works through SSH tunnels — unlike the
 * `clickhouse-client` CLI, which needs the native TCP port.
 */
export const serializeClickHouse = async (
  driver: ClickHouseDriver,
  database: string,
  tableNames: string[]
): Promise<string> => {
  let tables = tableNames
  if (tables.length === 0) {
    const all = await driver.getTables(database, '')
    tables = all.map(t => t.name)
  }

  logger.info(`ClickHouse backup: exporting ${tables.length} table(s)`)

  const parts: string[] = []
  for (const table of tables) {
    const ddl = (await driver.getTableDDL(table)).trim()
    if (ddl) parts.push(ddl.endsWith(';') ? ddl : `${ddl};`)

    // ClickHouse generates the INSERT statements; output_format_sql_insert_table_name makes
    // it emit the real table name instead of the literal "table".
    const escapedName = table.replace(/'/g, "\\'")
    const inserts = (await driver.queryRawText(
      `SELECT * FROM \`${table.replace(/`/g, '``')}\` SETTINGS output_format_sql_insert_table_name = '${escapedName}'`,
      'SQLInsert'
    )).trim()
    if (inserts) parts.push(inserts.endsWith(';') ? inserts : `${inserts};`)
  }

  return parts.join('\n\n') + '\n'
}

/**
 * Restore a ClickHouse database from a SQL document produced by {@link serializeClickHouse},
 * executing each statement over the driver (HTTP). Returns per-statement success/error counts.
 */
export const deserializeClickHouse = async (
  driver: ClickHouseDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> => {
  const statements = splitSqlStatements(content)
  let successCount = 0
  const errors: string[] = []

  for (const stmt of statements) {
    const sql = stmt.trim()
    if (!sql) continue
    const result = await driver.execute(sql)
    if (result.error) {
      errors.push(result.error)
      logger.warn(`ClickHouse restore: statement failed: ${result.error}`)
    } else {
      successCount++
    }
  }

  logger.info(`ClickHouse restore: ${successCount} statements ok, ${errors.length} errors`)
  return { successCount, errors }
}
