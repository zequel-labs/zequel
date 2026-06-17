import { writeSslTempFiles, mysqlSslMode } from '@main/services/backup/ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '@main/services/backup/process-args'
import type { BackupClient, BackupClientContext } from '@main/services/backup/models'
import { DatabaseType, SSLMode, type BackupCommandSpec } from '@main/types'

/** MySQL / MariaDB backup via mysqldump or mariadb-dump. */
export class MySqlBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for MySQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
    const env: Record<string, string> = {}
    if (password) env['MYSQL_PWD'] = password

    // SSL: MySQL uses --ssl-mode; MariaDB uses --ssl / --ssl-verify-server-cert
    if (conn.ssl) {
      if (conn.type === DatabaseType.MariaDB) {
        args.push('--ssl')
        if (conn.sslConfig?.mode === SSLMode.VerifyCA || conn.sslConfig?.mode === SSLMode.VerifyFull) {
          args.push('--ssl-verify-server-cert')
        }
      } else {
        args.push(`--ssl-mode=${mysqlSslMode(conn.sslConfig?.mode)}`)
      }
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push(`--ssl-ca=${ssl.ca}`); tempFiles.push(ssl.ca) }
        if (ssl.cert) { args.push(`--ssl-cert=${ssl.cert}`); tempFiles.push(ssl.cert) }
        if (ssl.key) { args.push(`--ssl-key=${ssl.key}`); tempFiles.push(ssl.key) }
      }
    }

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--user', conn.username)
    args.push(`--result-file=${config.outputPath}`)

    // Default to utf8mb4 so emoji / full 4-byte Unicode export correctly. MySQL's `utf8`
    // is really utf8mb3 and silently drops 4-byte characters. Overridable via the
    // `charset` option once the dynamic options UI surfaces it.
    const rawCharset = (config.options as Record<string, unknown>)['charset']
    const charset = typeof rawCharset === 'string' && rawCharset ? rawCharset : 'utf8mb4'
    args.push(`--default-character-set=${charset}`)

    const opts = config.options
    if (opts['single-transaction']) args.push('--single-transaction')
    if (opts['routines']) args.push('--routines')
    if (opts['triggers']) args.push('--triggers')
    if (opts['events']) args.push('--events')
    if (opts['add-drop-table']) args.push('--add-drop-table')
    if (opts['no-create-info']) args.push('--no-create-info')
    if (opts['no-data']) args.push('--no-data')

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    // Database name is a positional argument — must come after all flags.
    // --tables must be the absolute last arguments because mysqldump treats
    // everything after --tables as table names (not flags).
    args.push(conn.database)

    if (config.entities.length > 0) {
      args.push('--tables', ...config.entities.map(e => e.name))
    }

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { MYSQL_PWD: '********' } : {}),
    }
  }
}
