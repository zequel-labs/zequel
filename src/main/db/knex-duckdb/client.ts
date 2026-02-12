/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Custom Knex dialect client for DuckDB.
 *
 * DuckDB's SQL is largely compatible with SQLite but uses double-quote
 * identifiers and supports schemas, sequences, and RETURNING clauses.
 * This client extends the base Knex Client and wires up DuckDB-specific
 * compilers for query building, schema DDL, table DDL, and column types.
 *
 * Note: Zequel only uses Knex for SQL generation (toSQL / compileQuery),
 * not for actual query execution — that goes through @duckdb/node-api.
 */
import Client from 'knex/lib/client'
import { DuckDBQueryCompiler } from './query-compiler'
import { DuckDBSchemaCompiler } from './schema-compiler'
import { DuckDBColumnCompiler } from './column-compiler'
import { DuckDBTableCompiler } from './table-compiler'

class DuckDBClient extends (Client as any) {
  driverName = 'duckdb'
  dialect = 'duckdb'

  constructor(config: Record<string, unknown>) {
    super(config)
  }

  _driver() {
    return {}
  }

  wrapIdentifierImpl(value: string): string {
    if (value === '*') return '*'
    return `"${value.replace(/"/g, '""')}"`
  }

  queryCompiler(builder: any, formatter: any) {
    return new (DuckDBQueryCompiler as any)(this, builder, formatter)
  }

  schemaCompiler(...args: any[]) {
    return new (DuckDBSchemaCompiler as any)(this, ...args)
  }

  columnCompiler(...args: any[]) {
    return new (DuckDBColumnCompiler as any)(this, ...args)
  }

  tableCompiler(...args: any[]) {
    return new (DuckDBTableCompiler as any)(this, ...args)
  }
}

export default DuckDBClient
