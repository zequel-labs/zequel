import { parseCustomArgs } from '../process-args'
import type { BackupClient, BackupClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** DuckDB backup via the duckdb CLI `.dump` dot-command (full database only). */
export class DuckdbBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn } = ctx
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for DuckDB backup. Please check your connection settings.')
    }

    // DuckDB .dump does not support table-name arguments — always dumps the full database.
    // For selective export, use EXPORT DATABASE or COPY queries via customArgs.
    const dumpCommands = '.dump'
    const customArgsList = config.customArgs ? parseCustomArgs(config.customArgs) : []
    // duckdb format: duckdb [OPTIONS] FILENAME [SQL] — same as sqlite3
    const args = [...customArgsList, dbPath, dumpCommands]

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" "${dumpCommands}" > "${config.outputPath}"`,
    }
  }
}
