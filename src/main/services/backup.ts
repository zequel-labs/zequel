import { spawn, execSync, type ChildProcess } from 'child_process'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { BrowserWindow } from 'electron'
import archiver from 'archiver'
import { unlink, rename, stat } from 'fs/promises'
import { join, basename } from 'path'
import { logger } from '../utils/logger'
import { settingsService } from './settings'
import { keychainService } from './keychain'
import { sshTunnelManager } from './ssh-tunnel'
import {
  DatabaseType,
  DEFAULT_PORTS,
  type SavedConnection,
  type BackupConfig,
  type BackupBinaryInfo,
  type BackupCommandSpec,
  type BackupProgress,
  type RestoreConfig,
  BackupStatus,
} from '../types'

// ─── Constants ──────────────────────────────────────────────────────────────

const BACKUP_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'pg_dump' },
  [DatabaseType.MySQL]: { primary: 'mysqldump' },
  [DatabaseType.MariaDB]: { primary: 'mariadb-dump', fallback: 'mysqldump' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongodump' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
}

const RESTORE_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'psql' },
  [DatabaseType.MySQL]: { primary: 'mysql' },
  [DatabaseType.MariaDB]: { primary: 'mariadb', fallback: 'mysql' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongorestore' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
}

const COMMON_SEARCH_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/opt/homebrew/opt/postgresql/bin',
  '/opt/homebrew/opt/mysql/bin',
  '/opt/homebrew/opt/mariadb/bin',
  '/opt/homebrew/opt/sqlite/bin',
  '/opt/homebrew/opt/clickhouse/bin',
  '/opt/homebrew/opt/mongosh/bin',
  '/opt/homebrew/opt/redis/bin',
  '/Applications/Postgres.app/Contents/Versions/latest/bin',
  '/usr/local/opt/postgresql/bin',
  '/usr/local/opt/mysql/bin',
  '/usr/local/opt/mariadb/bin',
  '/usr/local/opt/redis/bin',
  '/Applications/Herd.app/Contents/Resources/mysql/bin',
  '/Users/Shared/Herd/services/postgresql/18/bin',
  '/Users/Shared/Herd/services/postgresql/17/bin',
  '/Users/Shared/Herd/services/postgresql/16/bin',
]

/** Max bytes of stdout/stderr kept in memory per operation */
const MAX_LOG_BYTES = 512 * 1024 // 512KB

/** Throttle IPC emission interval in ms */
const EMIT_THROTTLE_MS = 150

// ─── Helpers ────────────────────────────────────────────────────────────────

const findBinary = (
  binaryMap: Record<string, { primary: string; fallback?: string }>,
  dbType: DatabaseType,
  settingsKeyPrefix: string
): BackupBinaryInfo => {
  // 1. Check saved path from settings
  const savedPath = settingsService.get(`${settingsKeyPrefix}${dbType}`)
  if (savedPath && existsSync(savedPath)) {
    return { path: savedPath, found: true }
  }

  const mapping = binaryMap[dbType]
  if (!mapping) {
    return { path: null, found: false }
  }

  const binaries = [mapping.primary]
  if (mapping.fallback) binaries.push(mapping.fallback)

  for (const binary of binaries) {
    // 2. Scan common directories
    for (const dir of COMMON_SEARCH_DIRS) {
      const fullPath = join(dir, binary)
      if (existsSync(fullPath)) {
        return { path: fullPath, found: true }
      }
    }

    // 3. Fallback: which
    try {
      const result = execSync(`which ${binary}`, { encoding: 'utf-8', timeout: 5000 }).trim()
      if (result && existsSync(result)) {
        return { path: result, found: true }
      }
    } catch {
      // not found
    }
  }

  return { path: null, found: false }
}

const resolveHostPort = (connectionId: string, conn: SavedConnection): { host: string; port: number } => {
  let host = conn.host || 'localhost'
  let port = conn.port || DEFAULT_PORTS[conn.type]

  if (sshTunnelManager.hasTunnel(connectionId)) {
    const localPort = sshTunnelManager.getLocalPort(connectionId)
    if (localPort) {
      host = '127.0.0.1'
      port = localPort
    }
  }

  return { host, port }
}

const formatDisplayCommand = (
  binary: string,
  args: string[],
  env: Record<string, string>
): string => {
  const envStr = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  const escapedArgs = args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')
  return envStr ? `${envStr} ${binary} ${escapedArgs}` : `${binary} ${escapedArgs}`
}

/** Append text to a log string, keeping it under MAX_LOG_BYTES */
const appendLog = (current: string, chunk: string): string => {
  const combined = current + chunk
  if (combined.length > MAX_LOG_BYTES) {
    // Keep the last MAX_LOG_BYTES bytes; add a marker at the top
    return '...(truncated)\n' + combined.slice(combined.length - MAX_LOG_BYTES + 20)
  }
  return combined
}

// ─── Service ────────────────────────────────────────────────────────────────

class BackupService {
  private runningProcesses = new Map<string, ChildProcess>()
  private progressMap = new Map<string, BackupProgress>()
  private emitTimers = new Map<string, NodeJS.Timeout>()

  // ── Binary detection ────────────────────────────────────────────────────

  detectBackupBinary(dbType: DatabaseType): BackupBinaryInfo {
    return findBinary(BACKUP_BINARY_MAP, dbType, 'backup.binary.')
  }

  detectRestoreBinary(dbType: DatabaseType): BackupBinaryInfo {
    return findBinary(RESTORE_BINARY_MAP, dbType, 'restore.binary.')
  }

  // ── Backup command building ─────────────────────────────────────────────

  async buildBackupCommand(
    config: BackupConfig,
    connConfig: SavedConnection,
    password: string | null
  ): Promise<BackupCommandSpec> {
    const { host, port } = resolveHostPort(config.connectionId, connConfig)
    const env: Record<string, string> = {}

    switch (connConfig.type) {
      case DatabaseType.PostgreSQL:
        return this.buildPgDumpCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MySQL:
      case DatabaseType.MariaDB:
        return this.buildMysqldumpCommand(config, connConfig, password, host, port, env)
      case DatabaseType.SQLite:
        return this.buildSqlite3DumpCommand(config, connConfig)
      case DatabaseType.ClickHouse:
        return this.buildClickHouseDumpCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MongoDB:
        return this.buildMongodumpCommand(config, connConfig, password, host, port)
      case DatabaseType.Redis:
        return this.buildRedisDumpCommand(config, password, host, port, env)
      default:
        throw new Error(`Unsupported database type for backup: ${connConfig.type}`)
    }
  }

  // ── Restore command building ────────────────────────────────────────────

  async buildRestoreCommand(
    config: RestoreConfig,
    connConfig: SavedConnection,
    password: string | null
  ): Promise<BackupCommandSpec> {
    const { host, port } = resolveHostPort(config.connectionId, connConfig)
    const env: Record<string, string> = {}

    switch (connConfig.type) {
      case DatabaseType.PostgreSQL:
        return this.buildPsqlRestoreCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MySQL:
      case DatabaseType.MariaDB:
        return this.buildMysqlRestoreCommand(config, connConfig, password, host, port, env)
      case DatabaseType.SQLite:
        return this.buildSqlite3RestoreCommand(config, connConfig)
      case DatabaseType.ClickHouse:
        return this.buildClickHouseRestoreCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MongoDB:
        return this.buildMongorestoreCommand(config, connConfig, password, host, port)
      case DatabaseType.Redis:
        return this.buildRedisRestoreCommand(config, password, host, port, env)
      default:
        throw new Error(`Unsupported database type for restore: ${connConfig.type}`)
    }
  }

  // ── Execution ───────────────────────────────────────────────────────────

  executeBackup(config: BackupConfig, conn: SavedConnection): string {
    const operationId = `backup-${Date.now()}`
    this.initProgress(operationId)
    this.runBackup(operationId, config, conn)
    return operationId
  }

  executeRestore(config: RestoreConfig, conn: SavedConnection): string {
    const operationId = `restore-${Date.now()}`
    this.initProgress(operationId)
    this.runRestore(operationId, config, conn)
    return operationId
  }

  cancelOperation(operationId: string): boolean {
    const proc = this.runningProcesses.get(operationId)
    if (proc) {
      const progress = this.progressMap.get(operationId)
      if (progress) {
        progress.status = BackupStatus.Cancelled
        progress.stderr = appendLog(progress.stderr, '\nOperation cancelled by user.\n')
      }
      proc.kill('SIGTERM')
      this.runningProcesses.delete(operationId)
      if (progress) this.emitOutputNow(operationId, progress)
      return true
    }
    return false
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private initProgress(operationId: string): void {
    this.progressMap.set(operationId, {
      backupId: operationId,
      status: BackupStatus.Running,
      stdout: '',
      stderr: '',
    })
  }

  private async runBackup(operationId: string, config: BackupConfig, conn: SavedConnection): Promise<void> {
    const progress = this.progressMap.get(operationId)!

    try {
      const password = await keychainService.getPassword(config.connectionId)
      const spec = await this.buildBackupCommand(config, conn, password)

      logger.debug('Backup command built', {
        binary: spec.binary,
        database: conn.database,
        argsCount: spec.args.length,
        entitiesCount: config.entities.length,
      })

      this.emitOutputNow(operationId, progress)

      let proc: ChildProcess

      if (conn.type === DatabaseType.SQLite) {
        // Pipe stdout to file — avoids shell injection via table names
        const outputStream = createWriteStream(config.outputPath)
        outputStream.on('error', (err) => {
          logger.error(`Backup output stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nOutput stream error: ${err.message}`)
        })
        proc = spawn(spec.binary, spec.args, { env: { ...process.env, ...spec.env } })
        proc.stdout?.pipe(outputStream)
        proc.on('close', () => outputStream.end())
      } else if (conn.type === DatabaseType.ClickHouse) {
        const outputStream = createWriteStream(config.outputPath)
        outputStream.on('error', (err) => {
          logger.error(`Backup output stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nOutput stream error: ${err.message}`)
        })
        proc = spawn(spec.binary, spec.args, { env: { ...process.env, ...spec.env } })
        proc.stdout?.pipe(outputStream)
        proc.on('close', () => outputStream.end())
      } else {
        proc = spawn(spec.binary, spec.args, { env: { ...process.env, ...spec.env } })
      }

      await this.attachAndWait(operationId, proc, progress)

      if (config.compress && progress.status === BackupStatus.Completed) {
        await this.compressOutput(config.outputPath, operationId, progress)
      }
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelled) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  private async runRestore(operationId: string, config: RestoreConfig, conn: SavedConnection): Promise<void> {
    const progress = this.progressMap.get(operationId)!

    try {
      const password = await keychainService.getPassword(config.connectionId)
      const spec = await this.buildRestoreCommand(config, conn, password)

      this.emitOutputNow(operationId, progress)

      let proc: ChildProcess
      let inputStream: ReturnType<typeof createReadStream> | null = null

      const spawnEnv = { ...process.env, ...spec.env }

      if (conn.type === DatabaseType.SQLite) {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv, stdio: ['pipe', 'pipe', 'pipe'] })
        inputStream = createReadStream(config.inputPath, { highWaterMark: 64 * 1024 })
        inputStream.on('error', (err) => {
          logger.error(`Restore input stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
        })
        inputStream.pipe(proc.stdin!)
        proc.stdin!.on('error', (err) => {
          if (err.message.includes('EPIPE')) return
          logger.warn(`Restore stdin error: ${err.message}`)
        })
      } else if (conn.type === DatabaseType.MongoDB) {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv })
      } else if (conn.type === DatabaseType.Redis) {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv, stdio: ['pipe', 'pipe', 'pipe'] })
        inputStream = createReadStream(config.inputPath, { highWaterMark: 64 * 1024 })
        inputStream.on('error', (err) => {
          logger.error(`Restore input stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
        })
        inputStream.pipe(proc.stdin!)
        proc.stdin!.on('error', (err) => {
          if (err.message.includes('EPIPE')) return
          logger.warn(`Restore stdin error: ${err.message}`)
        })
      } else {
        const usesFileFlag = spec.args.some(a => a.startsWith('-f') || a.startsWith('--file'))

        if (usesFileFlag) {
          proc = spawn(spec.binary, spec.args, { env: spawnEnv })
        } else {
          proc = spawn(spec.binary, spec.args, {
            env: spawnEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          inputStream = createReadStream(config.inputPath, { highWaterMark: 64 * 1024 })
          inputStream.on('error', (err) => {
            logger.error(`Restore input stream error: ${err.message}`)
            progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
          })
          inputStream.pipe(proc.stdin!)

          proc.stdin!.on('error', (err) => {
            if (err.message.includes('EPIPE')) return
            logger.warn(`Restore stdin error: ${err.message}`)
          })
        }
      }

      if (inputStream) {
        const stream = inputStream
        proc.on('close', () => stream.destroy())
      }

      await this.attachAndWait(operationId, proc, progress)
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelled) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  /** Attach stdout/stderr handlers, store process, and wait for exit. */
  private attachAndWait(operationId: string, proc: ChildProcess, progress: BackupProgress): Promise<void> {
    this.runningProcesses.set(operationId, proc)

    proc.stdout?.on('data', (data: Buffer) => {
      progress.stdout = appendLog(progress.stdout, data.toString())
      this.throttledEmit(operationId, progress)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      progress.stderr = appendLog(progress.stderr, data.toString())
      this.throttledEmit(operationId, progress)
    })

    return new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        progress.exitCode = code ?? undefined
        if (progress.status === BackupStatus.Cancelled) {
          // Cancelled by user — don't override status
          resolve()
        } else if (code === 0) {
          progress.status = BackupStatus.Completed
          resolve()
        } else {
          progress.status = BackupStatus.Error
          reject(new Error(`Process exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        if (progress.status === BackupStatus.Cancelled) return resolve()
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, err.message)
        reject(err)
      })
    })
  }

  // ── Throttled IPC emission ──────────────────────────────────────────────

  private throttledEmit(operationId: string, progress: BackupProgress): void {
    if (this.emitTimers.has(operationId)) return // already scheduled
    const timer = setTimeout(() => {
      this.emitTimers.delete(operationId)
      this.emitOutputNow(operationId, progress)
    }, EMIT_THROTTLE_MS)
    this.emitTimers.set(operationId, timer)
  }

  private flushEmit(operationId: string, progress: BackupProgress): void {
    const timer = this.emitTimers.get(operationId)
    if (timer) {
      clearTimeout(timer)
      this.emitTimers.delete(operationId)
    }
    this.emitOutputNow(operationId, progress)
  }

  /** Clean up progress data after a delay to allow final reads */
  private scheduleCleanup(operationId: string): void {
    setTimeout(() => {
      this.progressMap.delete(operationId)
    }, 30_000)
  }

  private emitOutputNow(operationId: string, progress: BackupProgress): void {
    const channel = operationId.startsWith('restore-') ? 'restore:output' : 'backup:output'
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(channel, { ...progress })
    }
  }

  // ── Compression ─────────────────────────────────────────────────────────

  private async compressOutput(outputPath: string, operationId: string, progress: BackupProgress): Promise<void> {
    const zipPath = `${outputPath}.zip`
    const name = basename(outputPath)

    progress.stdout = appendLog(progress.stdout, '\nCompressing output...\n')
    this.emitOutputNow(operationId, progress)

    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('error', (err) => {
        logger.error(`Compression output stream error: ${err.message}`)
        reject(err)
      })

      output.on('close', async () => {
        try {
          // Remove the last extension and add .zip
          const lastDotIndex = outputPath.lastIndexOf('.')
          const basePath = lastDotIndex > outputPath.lastIndexOf('/') ? outputPath.slice(0, lastDotIndex) : outputPath
          const finalPath = basePath + '.zip'
          if (zipPath !== finalPath) await rename(zipPath, finalPath)
          // Delete original only after zip is confirmed written and renamed
          await unlink(outputPath)
          progress.stdout = appendLog(progress.stdout, `Compressed to ${finalPath}\n`)
          resolve()
        } catch (err) {
          reject(err)
        }
      })

      archive.on('error', reject)
      archive.pipe(output)

      stat(outputPath).then((stats) => {
        if (stats.isDirectory()) {
          archive.directory(outputPath, false)
        } else {
          archive.file(outputPath, { name })
        }
        archive.finalize()
      }).catch(reject)
    })
  }

  // ── Backup command builders ─────────────────────────────────────────────

  private buildPgDumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    if (password) env['PGPASSWORD'] = password

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--username', conn.username)
    args.push(`--dbname=${conn.database}`, '--format=plain', `--file=${config.outputPath}`)

    for (const entity of config.entities) {
      const qualified = entity.schema ? `${entity.schema}.${entity.name}` : entity.name
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

    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { PGPASSWORD: '********' } : {}),
    }
  }

  private buildMysqldumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for MySQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    if (password) env['MYSQL_PWD'] = password

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--user', conn.username)
    args.push(conn.database, `--result-file=${config.outputPath}`)

    if (config.entities.length > 0) {
      args.push('--tables', ...config.entities.map(e => e.name))
    }

    const opts = config.options
    if (opts['single-transaction']) args.push('--single-transaction')
    if (opts['routines']) args.push('--routines')
    if (opts['triggers']) args.push('--triggers')
    if (opts['events']) args.push('--events')
    if (opts['add-drop-table']) args.push('--add-drop-table')
    if (opts['no-create-info']) args.push('--no-create-info')
    if (opts['no-data']) args.push('--no-data')

    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { MYSQL_PWD: '********' } : {}),
    }
  }

  private buildSqlite3DumpCommand(config: BackupConfig, conn: SavedConnection): BackupCommandSpec {
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for SQLite backup. Please check your connection settings.')
    }
    const tables = config.entities.map(e => e.name)
    // Escape double quotes in table names to prevent injection in .dump commands
    const dumpCommands = tables.length > 0
      ? tables.map(t => `.dump "${t.replace(/"/g, '""')}"`).join('\n')
      : '.dump'
    const customArgsList = config.customArgs ? config.customArgs.split(/\s+/).filter(Boolean) : []
    // sqlite3 format: sqlite3 [OPTIONS] FILENAME [SQL] — options must precede filename
    const args = [...customArgsList, dbPath, dumpCommands]

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" "${dumpCommands}" > "${config.outputPath}"`,
    }
  }

  private buildClickHouseDumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for ClickHouse backup. Please check your connection settings.')
    }

    const tables = config.entities.map(e => e.name)
    // Escape backticks in table names to prevent injection
    const quoteIdent = (name: string): string => '`' + name.replace(/`/g, '\\`') + '`'
    const queries = tables.length > 0
      ? tables.map(t => `SELECT * FROM ${quoteIdent(t)} FORMAT TabSeparatedWithNames`).join('; ')
      : `SELECT name FROM system.tables WHERE database = currentDatabase() FORMAT TabSeparatedWithNames`

    // ClickHouse CLI uses native TCP port (default 9000), not HTTP port (8123).
    // Note: SSH tunnels are set up for the HTTP port, so CLI backup through an SSH tunnel
    // may not work correctly — the tunnel maps to 8123, but the CLI needs port 9000.
    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    if (conn.username) args.push('--user', conn.username)
    if (password) args.push('--password', password)
    args.push('--database', conn.database, '--query', queries)
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env,
      displayCommand: `${config.binaryPath} ${displayArgs.join(' ')} > "${config.outputPath}"`,
    }
  }

  private buildMongodumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB backup. Please check your connection settings.')
    }

    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    if (password) args.push('--password', password)
    args.push('--db', conn.database, `--out=${config.outputPath}`)

    // mongodump only supports --collection for a single collection.
    // For multiple collections, we need separate mongodump calls — but since that's complex,
    // we dump the whole database and note the limitation.
    // For a single collection, use --collection.
    if (config.entities.length === 1) {
      args.push('--collection', config.entities[0].name)
    }
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }

  private buildRedisDumpCommand(
    config: BackupConfig, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    const args: string[] = []
    if (password) env['REDISCLI_AUTH'] = password
    args.push('-h', host, '-p', String(port), '--rdb', config.outputPath)
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}),
    }
  }

  // ── Restore command builders ────────────────────────────────────────────

  private buildPsqlRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL restore. Please check your connection settings.')
    }

    const args: string[] = []
    if (password) env['PGPASSWORD'] = password

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--username', conn.username)
    args.push(`--dbname=${conn.database}`)
    args.push('-f', config.inputPath)

    const opts = config.options
    if (opts['no-owner']) args.push('--no-owner')
    if (opts['no-privileges']) args.push('--no-privileges')
    if (opts['clean']) args.push('--clean')
    if (opts['create']) args.push('--create')
    if (opts['data-only']) args.push('--data-only')
    if (opts['schema-only']) args.push('--schema-only')
    if (opts['verbose']) args.push('--verbose')
    if (opts['single-transaction']) args.push('--single-transaction')

    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { PGPASSWORD: '********' } : {}),
    }
  }

  private buildMysqlRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for MySQL restore. Please check your connection settings.')
    }

    // mysql reads SQL from stdin: mysql [opts] dbname < file.sql
    // We pipe the file via createReadStream for streaming
    const args: string[] = []
    if (password) env['MYSQL_PWD'] = password

    args.push('--host', host, '--port', String(port))
    if (conn.username) args.push('--user', conn.username)
    args.push(conn.database)

    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { MYSQL_PWD: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }

  private buildSqlite3RestoreCommand(config: RestoreConfig, conn: SavedConnection): BackupCommandSpec {
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for SQLite restore. Please check your connection settings.')
    }

    // sqlite3 dbpath < file.sql  — we pipe via stdin
    const args = [dbPath]
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" < "${config.inputPath}"`,
    }
  }

  private buildClickHouseRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for ClickHouse restore. Please check your connection settings.')
    }

    // ClickHouse CLI uses native TCP port (default 9000), not HTTP port (8123).
    // Note: SSH tunnels are set up for the HTTP port, so CLI restore through an SSH tunnel
    // may not work correctly — the tunnel maps to 8123, but the CLI needs port 9000.
    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    if (conn.username) args.push('--user', conn.username)
    if (password) args.push('--password', password)
    args.push('--database', conn.database, '--multiquery')
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}) + ` < "${config.inputPath}"`,
    }
  }

  private buildMongorestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB restore. Please check your connection settings.')
    }

    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    if (password) args.push('--password', password)
    args.push('--db', conn.database)

    if (config.isDirectory) {
      args.push(config.inputPath)
    } else {
      args.push(`--archive=${config.inputPath}`)
    }

    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }

  private buildRedisRestoreCommand(
    config: RestoreConfig, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    // redis-cli --pipe reads from stdin in mass-insert mode
    const args: string[] = []
    if (password) env['REDISCLI_AUTH'] = password
    args.push('-h', host, '-p', String(port), '--pipe')
    if (config.customArgs) args.push(...config.customArgs.split(/\s+/).filter(Boolean))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }
}

export const backupService = new BackupService()
