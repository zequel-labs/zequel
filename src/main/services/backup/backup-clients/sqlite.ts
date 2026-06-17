import { parseCustomArgs } from '../process-args'
import type { BackupClient, BackupClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** SQLite backup via the sqlite3 CLI `.dump` dot-command. */
export class SqliteBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn } = ctx
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for SQLite backup. Please check your connection settings.')
    }
    const tables = config.entities.map(e => e.name)
    // Escape double quotes and reject newlines in table names to prevent dot-command injection
    const safeName = (name: string): string => name.replace(/[\r\n]/g, '').replace(/"/g, '""')
    const dumpCommands = tables.length > 0
      ? tables.map(t => `.dump "${safeName(t)}"`).join('\n')
      : '.dump'
    const customArgsList = config.customArgs ? parseCustomArgs(config.customArgs) : []
    // sqlite3 format: sqlite3 [OPTIONS] FILENAME [SQL] — options must precede filename
    const args = [...customArgsList, dbPath, dumpCommands]

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" "${dumpCommands}" > "${config.outputPath}"`,
    }
  }
}
