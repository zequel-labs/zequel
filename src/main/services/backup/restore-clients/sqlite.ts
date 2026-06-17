import { parseCustomArgs } from '../process-args'
import type { RestoreClient, RestoreClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** SQLite restore: sqlite3 dbpath < file.sql (piped over stdin). */
export class SqliteRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn } = ctx
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for SQLite restore. Please check your connection settings.')
    }

    // sqlite3 dbpath < file.sql  — we pipe via stdin
    const args = [dbPath]
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" < "${config.inputPath}"`,
    }
  }
}
