import { writeSslTempFiles, mysqlSslMode } from '../ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { RestoreClient, RestoreClientContext } from '../models'
import { DatabaseType, SSLMode, type BackupCommandSpec } from '@main/types'

/** MySQL / MariaDB restore via mysql or mariadb (SQL piped over stdin). */
export class MySqlRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for MySQL restore. Please check your connection settings.')
    }

    // mysql reads SQL from stdin: mysql [opts] dbname < file.sql
    // We pipe the file via createReadStream for streaming
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
    // Match the backup's charset so emoji / 4-byte Unicode restore correctly.
    const rawCharset = (config.options as Record<string, unknown>)['charset']
    const charset = typeof rawCharset === 'string' && rawCharset ? rawCharset : 'utf8mb4'
    args.push(`--default-character-set=${charset}`)
    args.push(conn.database)

    const opts = config.options
    if (opts['force']) args.push('--force')

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { MYSQL_PWD: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }
}
