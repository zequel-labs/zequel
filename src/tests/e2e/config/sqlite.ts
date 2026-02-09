import { resolve } from 'path'

export const sqliteConfig = {
  type: 'SQLite',
  filepath: resolve(__dirname, '../../../../docker/sqlite/zequel.db'),
}
