import { parseCustomArgs } from '@main/services/backup/process-args'
import type { RestoreClient, RestoreClientContext } from '@main/services/backup/models'
import { type BackupCommandSpec } from '@main/types'

/** DuckDB restore: duckdb dbpath < file.sql (piped over stdin). */
export class DuckdbRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn } = ctx
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for DuckDB restore. Please check your connection settings.')
    }

    // duckdb dbpath < file.sql  — same pattern as sqlite3
    const args = [dbPath]
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" < "${config.inputPath}"`,
    }
  }
}
