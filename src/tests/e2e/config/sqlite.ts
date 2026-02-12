import { resolve } from 'path'

export const sqliteConfig = {
  type: 'SQLite',
  filepath: resolve(process.cwd(), 'docker/sqlite/zequel.db'),
}
