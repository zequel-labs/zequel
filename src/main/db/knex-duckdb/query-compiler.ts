/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DuckDB query compiler — extends the SQLite3 compiler from Knex.
 *
 * Overrides multi-row INSERT to use `SELECT … UNION ALL SELECT` syntax
 * (DuckDB does not support the `VALUES (...), (...)` shorthand in all
 * contexts when combined with ON CONFLICT / RETURNING).
 */
import SQLiteQueryCompiler from 'knex/lib/dialects/sqlite3/query/sqlite-querycompiler'
import isEmpty from 'lodash/isEmpty'

export class DuckDBQueryCompiler extends (SQLiteQueryCompiler as any) {
  insert() {
    const insertValues = (this as any).single.insert || []
    let sql = (this as any).with() + `insert into ${(this as any).tableName} `

    if (Array.isArray(insertValues)) {
      if (insertValues.length === 0) return ''
      if (insertValues.length === 1 && insertValues[0] && isEmpty(insertValues[0])) {
        return { sql: sql + (this as any)._emptyInsertValue }
      }
    } else if (typeof insertValues === 'object' && isEmpty(insertValues)) {
      return { sql: sql + (this as any)._emptyInsertValue }
    }

    const insertData = (this as any)._prepInsert(insertValues)
    if (typeof insertData === 'string') return { sql: sql + insertData }
    if (insertData.columns.length === 0) return { sql: '' }

    sql += `(${(this as any).formatter.columnize(insertData.columns)})`

    // Single-row insert — standard VALUES clause
    if (insertData.values.length === 1) {
      const parameters = (this as any).client.parameterize(
        insertData.values[0],
        (this as any).client.valueForUndefined,
        (this as any).builder,
        (this as any).bindingsHolder
      )
      sql += ` values (${parameters})`

      const { onConflict, ignore, merge } = (this as any).single
      if (onConflict && ignore) sql += (this as any)._ignore(onConflict)
      else if (onConflict && merge) {
        sql += (this as any)._merge(merge.updates, onConflict, insertValues)
        const wheres = (this as any).where()
        if (wheres) sql += ` ${wheres}`
      }

      const { returning } = (this as any).single
      if (returning) sql += (this as any)._returning(returning)

      return { sql, returning }
    }

    // Multi-row insert — SELECT … UNION ALL SELECT
    const blocks: string[] = []
    for (let i = 0; i < insertData.values.length; i++) {
      const row = insertData.values[i] ?? (this as any).client.valueForUndefined
      const cells: string[] = []
      for (let j = 0; j < insertData.columns.length; j++) {
        cells.push(
          (this as any).client.alias(
            (this as any).client.parameter(row[j], (this as any).builder, (this as any).bindingsHolder),
            (this as any).formatter.wrap(insertData.columns[j])
          )
        )
      }
      blocks.push(cells.join(', '))
    }
    sql += ' select ' + blocks.join(' union all select ')

    const { onConflict, ignore, merge } = (this as any).single
    if (onConflict && ignore) sql += ' where true' + (this as any)._ignore(onConflict)
    else if (onConflict && merge) {
      sql += ' where true' + (this as any)._merge(merge.updates, onConflict, insertValues)
    }

    const { returning } = (this as any).single
    if (returning) sql += (this as any)._returning(returning)

    return { sql, returning }
  }
}
