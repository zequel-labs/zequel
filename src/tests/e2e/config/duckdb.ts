import { resolve } from 'path'

export const duckdbConfig = {
  type: 'DuckDB',
  filepath: resolve(__dirname, '../../../../docker/duckdb/zequel.duckdb'),
}
