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
    const args: string[] = ['-b', '-S', `${host},${port}`]
    if (conn.username) args.push('-U', conn.username)
    if (password) sqlcmdEnv['SQLCMDPASSWORD'] = password
    if (conn.ssl) args.push('-N')
    if (conn.trustServerCertificate) args.push('-C')

    // sqlcmd -Q takes a SQL string via command line — parameterization isn't possible.
    // Identifiers are bracket-escaped (]] for ]) and paths are N-string-escaped ('' for ').
    let moves = ''
    if (typeof config.options['fileMoves'] === 'string') {
      const files: unknown = JSON.parse(config.options['fileMoves'])
      if (!Array.isArray(files)) throw new Error('Invalid restore file mapping')
      moves = files.map((entry: unknown) => {
        const file = entry as { logical?: unknown; path?: unknown }
        if (typeof file?.logical !== 'string' || typeof file?.path !== 'string' || !file.path || file.path.includes('\0')) throw new Error('Invalid restore file mapping')
        return `, MOVE N'${file.logical.replace(/'/g, "''")}' TO N'${file.path.replace(/'/g, "''")}'`
      }).join('')
    }
    const restoreQuery = `RESTORE DATABASE [${conn.database.replace(/\]/g, ']]')}] FROM DISK = N'${config.inputPath.replace(/'/g, "''")}' WITH CHECKSUM, STATS = 5${moves}${config.options['replace'] === true ? ', REPLACE' : ''}`
    args.push('-Q', restoreQuery)

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: sqlcmdEnv,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { SQLCMDPASSWORD: '********' } : {}),
    }
  }
}
