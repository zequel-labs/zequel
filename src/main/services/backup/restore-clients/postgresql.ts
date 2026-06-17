import { open, stat } from 'fs/promises'
import { dirname, join, basename } from 'path'
import { writeSslTempFiles, pgSslMode } from '../ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { RestoreClient, RestoreClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** Detect a pg_dump custom-format archive by its "PGDMP" magic header. */
const isCustomArchive = async (filePath: string): Promise<boolean> => {
  try {
    const fh = await open(filePath, 'r')
    try {
      const buf = Buffer.alloc(5)
      await fh.read(buf, 0, 5, 0)
      return buf.toString('latin1') === 'PGDMP'
    } finally {
      await fh.close()
    }
  } catch {
    return false
  }
}

/** Derive the pg_restore binary path from the configured psql path (same directory). */
const pgRestorePath = (psqlPath: string): string =>
  join(dirname(psqlPath), basename(psqlPath).replace(/psql(\.exe)?$/i, 'pg_restore$1'))

/**
 * PostgreSQL restore. Plain SQL dumps are replayed via psql (`-f`); custom-format archives
 * (`pg_dump -Fc`, detected by the PGDMP magic header) are restored via pg_restore reading
 * the archive from stdin (the service pipes the input file in).
 */
export class PostgresRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL restore. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
    const env: Record<string, string> = {}
    if (password) env['PGPASSWORD'] = password

    // SSL: pg_restore and psql share the same libpq env vars as pg_dump.
    if (conn.ssl) {
      env['PGSSLMODE'] = pgSslMode(conn.sslConfig?.mode)
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { env['PGSSLROOTCERT'] = ssl.ca; tempFiles.push(ssl.ca) }
        if (ssl.cert) { env['PGSSLCERT'] = ssl.cert; tempFiles.push(ssl.cert) }
        if (ssl.key) { env['PGSSLKEY'] = ssl.key; tempFiles.push(ssl.key) }
      }
    }

    const opts = config.options
    const isDirectory = await stat(config.inputPath).then(s => s.isDirectory()).catch(() => false)
    const custom = !isDirectory && await isCustomArchive(config.inputPath)

    if (isDirectory) {
      // Directory-format dump (pg_dump -Fd): pg_restore reads the directory as an argument
      // and supports parallel restore (--jobs). The service must not pipe stdin.
      const binary = pgRestorePath(config.binaryPath)
      args.push('--host', host, '--port', String(port))
      if (conn.username) args.push('--username', conn.username)
      args.push(`--dbname=${conn.database}`)
      const rawJobs = opts['jobs']
      if (typeof rawJobs === 'number' && rawJobs > 1) args.push('--jobs', String(rawJobs))
      if (opts['single-transaction']) args.push('--single-transaction')
      if (opts['no-owner']) args.push('--no-owner')
      if (opts['clean']) args.push('--clean')
      if (opts['create']) args.push('--create')
      if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))
      args.push(config.inputPath)

      return {
        binary, args, env, tempFiles, inputAsArg: true,
        displayCommand: formatDisplayCommand(binary, args, password ? { PGPASSWORD: '********' } : {}),
      }
    }

    if (custom) {
      // pg_restore reads the custom archive from stdin (no -f), so the service's stdin
      // piping applies. pg_restore accepts the richer flag set psql rejects.
      const binary = pgRestorePath(config.binaryPath)
      args.push('--host', host, '--port', String(port))
      if (conn.username) args.push('--username', conn.username)
      args.push(`--dbname=${conn.database}`)
      if (opts['single-transaction']) args.push('--single-transaction')
      if (opts['no-owner']) args.push('--no-owner')
      if (opts['clean']) args.push('--clean')
      if (opts['create']) args.push('--create')
      if (opts['verbose']) args.push('--verbose')
      if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

      return {
        binary, args, env, tempFiles,
        displayCommand: formatDisplayCommand(binary, args, password ? { PGPASSWORD: '********' } : {}) + ` < "${config.inputPath}"`,
      }
    }

    // Plain SQL dump → psql -f. psql only supports --single-transaction and --echo-all from
    // our option set; the others (--no-owner, --clean, --create) are pg_restore-only flags.
    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--username', conn.username)
    args.push(`--dbname=${conn.database}`)
    args.push('-f', config.inputPath)
    if (opts['single-transaction']) args.push('--single-transaction')
    if (opts['verbose']) args.push('--echo-all')
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { PGPASSWORD: '********' } : {}),
    }
  }
}
