import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { BackupClient, BackupClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** SQL Server backup via sqlcmd `BACKUP DATABASE` (native .bak on the server). */
export class SqlServerBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for SQL Server backup. Please check your connection settings.')
    }

    // sqlcmd -S host,port -U user — password via SQLCMDPASSWORD env var
    const sqlcmdEnv: Record<string, string> = {}
    const args: string[] = ['-S', `${host},${port}`]
    if (conn.username) args.push('-U', conn.username)
    if (password) sqlcmdEnv['SQLCMDPASSWORD'] = password
    // SSL: -N enables encryption, -C trusts server certificate
    if (conn.ssl) args.push('-N')
    if (conn.trustServerCertificate) args.push('-C')

    // sqlcmd -Q takes a SQL string via command line — parameterization isn't possible.
    // Identifiers are bracket-escaped (]] for ]) and paths are N-string-escaped ('' for ').
    const backupQuery = `BACKUP DATABASE [${conn.database.replace(/\]/g, ']]')}] TO DISK = N'${config.outputPath.replace(/'/g, "''")}' WITH FORMAT, INIT`
    args.push('-Q', backupQuery)

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: sqlcmdEnv,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { SQLCMDPASSWORD: '********' } : {}),
    }
  }
}
