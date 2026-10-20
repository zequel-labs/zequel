import { parentPort } from 'node:worker_threads'
import { SQLiteDriver } from '@main/db/sqlite'
import { serveSQLiteRows } from '@main/services/row-transfer-sqlite'

if (!parentPort) throw new Error('The SQLite transfer worker must run in a worker thread')
serveSQLiteRows(parentPort, () => new SQLiteDriver())
