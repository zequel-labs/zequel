import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

const SOURCE_DB = resolve(process.cwd(), 'docker/sqlite/zequel.db')

/**
 * Returns a per-worker copy of the SQLite DB to avoid file locking
 * conflicts when multiple Playwright workers run in parallel.
 */
const getWorkerDb = (): string => {
  const workerId = process.env.TEST_WORKER_INDEX ?? '0'
  const dir = resolve(process.cwd(), 'test-results', '.sqlite-copies')
  mkdirSync(dir, { recursive: true })
  const dest = resolve(dir, `zequel-worker-${workerId}.db`)
  copyFileSync(SOURCE_DB, dest)
  return dest
}

export const sqliteConfig = {
  type: 'SQLite',
  filepath: getWorkerDb(),
}
