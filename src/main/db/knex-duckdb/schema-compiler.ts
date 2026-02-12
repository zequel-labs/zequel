/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DuckDB schema compiler — adds CREATE/DROP SCHEMA support
 * that the base SQLite3 compiler does not provide.
 */
import SQLiteSchemaCompiler from 'knex/lib/dialects/sqlite3/schema/sqlite-compiler'

export class DuckDBSchemaCompiler extends (SQLiteSchemaCompiler as any) {
  createSchema(schemaName: string) {
    ;(this as any).pushQuery(`create schema ${(this as any).formatter.wrap(schemaName)}`)
  }

  createSchemaIfNotExists(schemaName: string) {
    ;(this as any).pushQuery(`create schema if not exists ${(this as any).formatter.wrap(schemaName)}`)
  }

  dropSchema(schemaName: string, cascade = false) {
    ;(this as any).pushQuery(
      `drop schema ${(this as any).formatter.wrap(schemaName)}${cascade ? ' cascade' : ''}`
    )
  }

  dropSchemaIfExists(schemaName: string, cascade = false) {
    ;(this as any).pushQuery(
      `drop schema if exists ${(this as any).formatter.wrap(schemaName)}${cascade ? ' cascade' : ''}`
    )
  }
}
