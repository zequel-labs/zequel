/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DuckDB table compiler — fixes primary key and table name
 * formatting for DuckDB's SQL dialect.
 */
import filter from 'lodash/filter'
import SQLiteTableCompiler from 'knex/lib/dialects/sqlite3/schema/sqlite-tablecompiler'

export class DuckDBTableCompiler extends (SQLiteTableCompiler as any) {
  primaryKeys() {
    const pks = filter((this as any).grouped.alterTable || [], { method: 'primary' })
    if (pks.length > 0 && (pks[0] as any).args.length > 0) {
      const columns = (pks[0] as any).args[0]
      let constraintName = (pks[0] as any).args[1] || ''
      if (constraintName) {
        constraintName = ' constraint ' + (this as any).formatter.wrap(constraintName)
      }
      return `,${constraintName} primary key (${(this as any).formatter.columnize(columns)})`
    }
  }

  tableName() {
    return (this as any).formatter.wrap((this as any).tableNameRaw)
  }
}
