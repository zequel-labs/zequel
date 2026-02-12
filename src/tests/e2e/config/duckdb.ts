import { resolve } from 'path'

export const duckdbConfig = {
  type: 'DuckDB',
  filepath: resolve(process.cwd(), 'docker/duckdb/zequel.duckdb'),
}
