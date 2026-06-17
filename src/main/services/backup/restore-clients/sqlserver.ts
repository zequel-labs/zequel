import { parseCustomArgs, formatDisplayCommand } from '@main/services/backup/process-args'
import type { RestoreClient, RestoreClientContext } from '@main/services/backup/models'
import { type BackupCommandSpec } from '@main/types'

/** SQL Server restore via sqlcmd `RESTORE DATABASE` (native .bak on the server). */
export class SqlServerRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for SQL Server restore. Please check your connection settings.')
    }

    const sqlcmdEnv: Record<string, string> = {}
    const args: string[] = ['-S', `${host},${port}`]
    if (conn.username) args.push('-U', conn.username)
    if (password) sqlcmdEnv['SQLCMDPASSWORD'] = password
    if (conn.ssl) args.push('-N')
    if (conn.trustServerCertificate) args.push('-C')

    // sqlcmd -Q takes a SQL string via command line — parameterization isn't possible.
    // Identifiers are bracket-escaped (]] for ]) and paths are N-string-escaped ('' for ').
    const restoreQuery = `RESTORE DATABASE [${conn.database.replace(/\]/g, ']]')}] FROM DISK = N'${config.inputPath.replace(/'/g, "''")}' WITH REPLACE`
    args.push('-Q', restoreQuery)

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: sqlcmdEnv,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { SQLCMDPASSWORD: '********' } : {}),
    }
  }
}
