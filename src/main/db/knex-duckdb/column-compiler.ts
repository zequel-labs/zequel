/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DuckDB column compiler — overrides auto-increment columns to use
 * DuckDB sequences instead of SQLite's AUTOINCREMENT keyword.
 */
import SQLiteColumnCompiler from 'knex/lib/dialects/sqlite3/schema/sqlite-columncompiler'

export class DuckDBColumnCompiler extends (SQLiteColumnCompiler as any) {
  increments(options: { primaryKey?: boolean } = { primaryKey: true }) {
    const sequence = `${(this as any).tableCompiler.tableNameRaw}_seq_id`
    ;(this as any).pushAdditional(function (this: any) {
      this.pushQuery(`create sequence ${this.formatter.wrap(sequence)} start 1`)
      this.pushQuery(
        `alter table ${this.formatter.wrap(this.tableCompiler.tableNameRaw)} ` +
        `alter column ${this.formatter.wrap(this.getColumnName())} ` +
        `set default nextval('${sequence}')`
      )
    })
    return (
      'integer not null' +
      ((this as any).tableCompiler._canBeAddPrimaryKey(options) ? ' primary key' : '')
    )
  }
}
