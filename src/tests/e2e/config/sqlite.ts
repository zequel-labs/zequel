import { resolve } from 'path'

export const sqliteConfig = {
  type: 'SQLite' as const,
  filepath: resolve(process.cwd(), 'docker/sqlite/zequel.db'),
}
