import { writeSslTempFiles, pgSslMode } from '@main/services/backup/ssl-temp'
import { parseCustomArgs, formatDisplayCommand, getStringOption } from '@main/services/backup/process-args'
import type { BackupClient, BackupClientContext } from '@main/services/backup/models'
import { PgDumpFormat, type BackupCommandSpec } from '@main/types'

/** PostgreSQL backup via pg_dump. Produces the same BackupCommandSpec the service built before. */
export class PostgresBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
    const env: Record<string, string> = {}
    if (password) env['PGPASSWORD'] = password

    // SSL: pg_dump uses libpq env vars for SSL configuration
    if (conn.ssl) {
      env['PGSSLMODE'] = pgSslMode(conn.sslConfig?.mode)
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { env['PGSSLROOTCERT'] = ssl.ca; tempFiles.push(ssl.ca) }
        if (ssl.cert) { env['PGSSLCERT'] = ssl.cert; tempFiles.push(ssl.cert) }
        if (ssl.key) { env['PGSSLKEY'] = ssl.key; tempFiles.push(ssl.key) }
      }
    }

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--username', conn.username)

    // Format: 'plain' (readable .sql, restored via psql) is the default; 'custom' (-Fc) is a
    // single natively-compressed archive restored via pg_restore (smaller, faster restore).
    const rawFormat = config.options['format']
    const format = rawFormat === PgDumpFormat.Custom
      ? PgDumpFormat.Custom
      : rawFormat === PgDumpFormat.Directory
        ? PgDumpFormat.Directory
        : PgDumpFormat.Plain
    args.push(`--dbname=${conn.database}`, `--format=${format}`, `--file=${config.outputPath}`)

    // Encoding: default UTF8 so the dump preserves full Unicode (emoji, multibyte text).
    args.push(`--encoding=${getStringOption(config.options, 'encoding', 'UTF8')}`)

    // Native compression level (0–9) — supported by both the custom and directory formats.
    const rawCompression = config.options['compression']
    if ((format === PgDumpFormat.Custom || format === PgDumpFormat.Directory) && typeof rawCompression === 'number') {
      args.push(`--compress=${rawCompression}`)
    }

    // Parallel dump jobs — only the directory format supports `--jobs`.
    const rawJobs = config.options['jobs']
    if (format === PgDumpFormat.Directory && typeof rawJobs === 'number' && rawJobs > 1) {
      args.push('--jobs', String(rawJobs))
    }

    for (const entity of config.entities) {
      // pg_dump --table accepts schema.table patterns — quote identifiers to handle special chars
      const quotePgIdent = (name: string): string => '"' + name.replace(/"/g, '""') + '"'
      const qualified = entity.schema
        ? `${quotePgIdent(entity.schema)}.${quotePgIdent(entity.name)}`
        : quotePgIdent(entity.name)
      args.push(`--table=${qualified}`)
    }

    const opts = config.options
    if (opts['inserts']) args.push('--inserts')
    if (opts['no-owner']) args.push('--no-owner')
    if (opts['no-privileges']) args.push('--no-privileges')
    if (opts['clean']) args.push('--clean')
    if (opts['create']) args.push('--create')
    if (opts['data-only']) args.push('--data-only')
    if (opts['schema-only']) args.push('--schema-only')
    if (opts['verbose']) args.push('--verbose')

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { PGPASSWORD: '********' } : {}),
    }
  }
}
