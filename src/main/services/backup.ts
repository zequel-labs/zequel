import { spawn, execSync, execFileSync, type ChildProcess } from 'child_process'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { BrowserWindow } from 'electron'
import archiver from 'archiver'
import extract from 'extract-zip'
import { unlink, rename, stat, writeFile, mkdtemp, rmdir, rm, readdir } from 'fs/promises'
import { join, basename, parse as parsePath } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '@main/utils/logger'
import { settingsService } from './settings'
import { sshTunnelManager } from './ssh-tunnel'
import {
  DatabaseType,
  DEFAULT_PORTS,
  SSLMode,
  type SavedConnection,
  type SSLConfig,
  type BackupConfig,
  type BackupBinaryInfo,
  type BackupCommandSpec,
  type BackupProgress,
  type RestoreConfig,
  BackupStatus,
} from '@main/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const BACKUP_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'pg_dump' },
  [DatabaseType.MySQL]: { primary: 'mysqldump' },
  [DatabaseType.MariaDB]: { primary: 'mariadb-dump', fallback: 'mysqldump' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.DuckDB]: { primary: 'duckdb' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongodump' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
  [DatabaseType.SQLServer]: { primary: 'sqlcmd' },
}

const RESTORE_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'psql' },
  [DatabaseType.MySQL]: { primary: 'mysql' },
  [DatabaseType.MariaDB]: { primary: 'mariadb', fallback: 'mysql' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.DuckDB]: { primary: 'duckdb' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongorestore' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
  [DatabaseType.SQLServer]: { primary: 'sqlcmd' },
}

const getSearchDirs = (): string[] => {
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] || 'C:\\Users\\Default\\AppData\\Local'
    return [
      'C:\\Program Files\\PostgreSQL\\17\\bin',
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin',
      'C:\\Program Files\\MariaDB 11.4\\bin',
      'C:\\Program Files\\MariaDB 10.11\\bin',
      'C:\\Program Files\\MongoDB\\Server\\8.0\\bin',
      'C:\\Program Files\\MongoDB\\Server\\7.0\\bin',
      'C:\\Program Files\\Redis\\',
      'C:\\tools\\',
      join(localAppData, 'Programs'),
      'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn',
      'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\180\\Tools\\Binn',
    ]
  }

  // macOS + Linux paths (macOS-specific like Homebrew/Herd are harmlessly skipped on Linux)
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    // Linux distribution-specific paths
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/lib/postgresql/15/bin',
    '/usr/share/clickhouse/bin',
    '/opt/homebrew/opt/postgresql/bin',
    '/opt/homebrew/opt/mysql/bin',
    '/opt/homebrew/opt/mysql-client@8.0/bin',
    '/opt/homebrew/opt/mysql-client@8.4/bin',
    '/opt/homebrew/opt/mysql-client/bin',
    '/opt/homebrew/opt/mariadb/bin',
    '/opt/homebrew/opt/sqlite/bin',
    '/opt/homebrew/opt/clickhouse/bin',
    '/opt/homebrew/opt/mongosh/bin',
    '/opt/homebrew/opt/redis/bin',
    '/Applications/Postgres.app/Contents/Versions/latest/bin',
    '/usr/local/opt/postgresql/bin',
    '/usr/local/opt/mysql/bin',
    '/usr/local/opt/mysql-client@8.0/bin',
    '/usr/local/opt/mariadb/bin',
    '/usr/local/opt/redis/bin',
    '/Applications/Herd.app/Contents/Resources/mysql/bin',
    '/Users/Shared/Herd/services/mysql/8.0/bin',
    '/Users/Shared/Herd/services/mysql/8.4/bin',
    '/Users/Shared/Herd/services/mysql/9.0/bin',
    '/Users/Shared/Herd/services/mysql/9.4/bin',
    '/Users/Shared/Herd/services/postgresql/18/bin',
    '/Users/Shared/Herd/services/postgresql/17/bin',
    '/Users/Shared/Herd/services/postgresql/16/bin',
    '/opt/mssql-tools18/bin',
    '/opt/mssql-tools/bin',
  ]
}

/** Max bytes of stdout/stderr kept in memory per operation */
const MAX_LOG_BYTES = 512 * 1024 // 512KB

/** Throttle IPC emission interval in ms */
const EMIT_THROTTLE_MS = 150

/** File extensions recognized as restorable database dumps inside ZIP archives. */
const KNOWN_RESTORE_EXTENSIONS = ['.sql', '.dump', '.bson', '.rdb', '.bak']

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Split a custom args string respecting single/double quotes (e.g. --config="/path with spaces/f.ini"). */
const parseCustomArgs = (input: string): string[] => {
  const args: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (/\s/.test(ch) && !inSingle && !inDouble) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) args.push(current)
  return args
}

/** Extract the major version number from a binary's --version output. */
const detectBinaryVersion = (binaryPath: string): string | null => {
  try {
    // Use execFileSync to avoid shell interpretation of special characters in binary paths
    const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim()
    // Match patterns like "mysqldump  Ver 9.4.0" or "pg_dump (PostgreSQL) 16.2"
    const match = output.match(/(\d+\.\d+(?:\.\d+)?)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/** MySQL-specific: check if binary version is 9.x+ and warn about mysql_native_password removal. */
const getMysqlVersionWarning = (version: string | null): string | null => {
  if (!version) return null
  const major = parseInt(version.split('.')[0], 10)
  if (major >= 9) {
    const installHint = process.platform === 'win32'
      ? 'Install MySQL 8.x from https://dev.mysql.com/downloads/'
      : 'brew install mysql-client@8.0'
    return `mysqldump ${version} does not support mysql_native_password authentication (removed in MySQL 9.0). If your server uses this auth plugin, use mysqldump 8.x instead (${installHint}).`
  }
  return null
}

const findBinary = (
  binaryMap: Record<string, { primary: string; fallback?: string }>,
  dbType: DatabaseType,
  settingsKeyPrefix: string
): BackupBinaryInfo => {
  const notFound: BackupBinaryInfo = { path: null, found: false, version: null, warning: null }

  // 1. Check saved path from settings
  const savedPath = settingsService.get(`${settingsKeyPrefix}${dbType}`)
  if (savedPath && existsSync(savedPath)) {
    const version = detectBinaryVersion(savedPath)
    // Only MySQL (not MariaDB) removed mysql_native_password in 9.0
    const warning = dbType === DatabaseType.MySQL ? getMysqlVersionWarning(version) : null
    return { path: savedPath, found: true, version, warning }
  }

  const mapping = binaryMap[dbType]
  if (!mapping) {
    return notFound
  }

  const binaries = [mapping.primary]
  if (mapping.fallback) binaries.push(mapping.fallback)

  const isMysql = dbType === DatabaseType.MySQL
  const ext = process.platform === 'win32' ? '.exe' : ''
  const searchDirs = getSearchDirs()

  for (const binary of binaries) {
    // 2. Scan common directories
    for (const dir of searchDirs) {
      const fullPath = join(dir, binary + ext)
      if (existsSync(fullPath)) {
        const version = detectBinaryVersion(fullPath)
        const warning = isMysql ? getMysqlVersionWarning(version) : null
        return { path: fullPath, found: true, version, warning }
      }
    }

    // 3. Fallback: which (Unix) / where (Windows)
    try {
      const cmd = process.platform === 'win32' ? `where ${binary}` : `which ${binary}`
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
      // `where` on Windows returns multiple lines — take the first match
      const result = output.split(/\r?\n/)[0].trim()
      if (result && existsSync(result)) {
        const version = detectBinaryVersion(result)
        const warning = isMysql ? getMysqlVersionWarning(version) : null
        return { path: result, found: true, version, warning }
      }
    } catch {
      // not found
    }
  }

  return notFound
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

/**
 * Write SSL cert/key/ca PEM content to secure temp files for CLI tools.
 * Returns the temp file paths and the temp directory for cleanup.
 */
const writeSslTempFiles = async (sslConfig: SSLConfig): Promise<{ ca?: string; cert?: string; key?: string; dir: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'zequel-ssl-'))
  const result: { ca?: string; cert?: string; key?: string; dir: string } = { dir }

  try {
    if (sslConfig.ca) {
      const caPath = join(dir, 'ca.pem')
      await writeFile(caPath, sslConfig.ca, { mode: 0o600 })
      result.ca = caPath
    }
    if (sslConfig.cert) {
      const certPath = join(dir, 'cert.pem')
      await writeFile(certPath, sslConfig.cert, { mode: 0o600 })
      result.cert = certPath
    }
    if (sslConfig.key) {
      const keyPath = join(dir, 'key.pem')
      await writeFile(keyPath, sslConfig.key, { mode: 0o600 })
      result.key = keyPath
    }
  } catch (err) {
    // Clean up partially created temp files and directory on failure
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  return result
}

/** Remove temp SSL files, extraction directories, and their parent directories. */
const cleanupTempFiles = async (files: string[]): Promise<void> => {
  const parentDirs = new Set<string>()
  for (const f of files) {
    try {
      await unlink(f)
      parentDirs.add(join(f, '..'))
    } catch {
      // unlink fails on directories — fall back to recursive rm
      try { await rm(f, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  for (const d of parentDirs) {
    try { await rmdir(d) } catch { /* ignore — dir may not be empty */ }
  }
}

/**
 * If the input path is a .zip file, extract it to a temp directory and return
 * the path to the first SQL/dump file inside. Returns the original path unchanged
 * for non-zip files. The caller must clean up `tempDir` when done.
 */
const decompressIfZip = async (inputPath: string): Promise<{ resolvedPath: string; tempDir: string | null }> => {
  if (!inputPath.toLowerCase().endsWith('.zip')) {
    return { resolvedPath: inputPath, tempDir: null }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'zequel-restore-'))
  try {
    await extract(inputPath, { dir: tempDir })
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  const files = await readdir(tempDir)
  const lower = (name: string): string => name.toLowerCase()
  const sqlFile = files.find(f =>
    KNOWN_RESTORE_EXTENSIONS.some(ext => lower(f).endsWith(ext))
  )

  if (!sqlFile) {
    // Single-file zips from our own backup process
    if (files.length === 1) {
      return { resolvedPath: join(tempDir, files[0]), tempDir }
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw new Error('No SQL or dump file found inside the ZIP archive.')
  }

  return { resolvedPath: join(tempDir, sqlFile), tempDir }
}

/** Map SSLMode enum to PostgreSQL sslmode string. */
const pgSslMode = (mode?: SSLMode): string => {
  switch (mode) {
    case SSLMode.Disable: return 'disable'
    case SSLMode.Prefer: return 'prefer'
    case SSLMode.Require: return 'require'
    case SSLMode.VerifyCA: return 'verify-ca'
    case SSLMode.VerifyFull: return 'verify-full'
    default: return 'require'
  }
}

/** Map SSLMode to MySQL --ssl-mode value. MariaDB uses --ssl / --ssl-verify-server-cert instead. */
const mysqlSslMode = (mode?: SSLMode): string => {
  switch (mode) {
    case SSLMode.VerifyCA: return 'VERIFY_CA'
    case SSLMode.VerifyFull: return 'VERIFY_IDENTITY'
    default: return 'REQUIRED'
  }
}

/**
 * Build minimal spawn env: only PATH + operation-specific env vars.
 * Avoids leaking the full process.env to child processes.
 */
const buildSpawnEnv = (extraEnv: Record<string, string>): Record<string, string> => {
  const base: Record<string, string> = {}
  const passthrough = [
    'PATH',                   // binary & shared library lookup
    'HOME',                   // .pgpass, .my.cnf, etc.
    'USERPROFILE',            // Windows HOME equivalent
    'TMPDIR', 'TEMP', 'TMP', // temp directories
    'LANG', 'LC_ALL',        // locale / encoding
    'SystemRoot',             // Windows DLL / system calls
    'LD_LIBRARY_PATH',        // Linux shared libraries
    'DYLD_LIBRARY_PATH',      // macOS shared libraries
    'DYLD_FALLBACK_LIBRARY_PATH',
  ]
  for (const key of passthrough) {
    if (process.env[key]) base[key] = process.env[key]!
  }
  return { ...base, ...extraEnv }
}

// ─── Service ────────────────────────────────────────────────────────────────

class BackupService {
  private runningProcesses = new Map<string, ChildProcess>()
  private progressMap = new Map<string, BackupProgress>()
  private emitTimers = new Map<string, NodeJS.Timeout>()
  private requestingWindow = new Map<string, number>()

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
      case DatabaseType.DuckDB:
        return this.buildDuckdbDumpCommand(config, connConfig)
      case DatabaseType.ClickHouse:
        return this.buildClickHouseDumpCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MongoDB:
        return this.buildMongodumpCommand(config, connConfig, password, host, port)
      case DatabaseType.Redis:
        return this.buildRedisDumpCommand(config, connConfig, password, host, port, env)
      case DatabaseType.SQLServer:
        return this.buildSqlcmdBackupCommand(config, connConfig, password, host, port)
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
    // Allow the user to pick a different target database than the connection default
    if (config.targetDatabase) {
      connConfig = { ...connConfig, database: config.targetDatabase }
    }

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
      case DatabaseType.DuckDB:
        return this.buildDuckdbRestoreCommand(config, connConfig)
      case DatabaseType.ClickHouse:
        return this.buildClickHouseRestoreCommand(config, connConfig, password, host, port, env)
      case DatabaseType.MongoDB:
        return this.buildMongorestoreCommand(config, connConfig, password, host, port)
      case DatabaseType.Redis:
        return this.buildRedisRestoreCommand(config, connConfig, password, host, port, env)
      case DatabaseType.SQLServer:
        return this.buildSqlcmdRestoreCommand(config, connConfig, password, host, port)
      default:
        throw new Error(`Unsupported database type for restore: ${connConfig.type}`)
    }
  }

  // ── Execution ───────────────────────────────────────────────────────────

  executeBackup(config: BackupConfig, conn: SavedConnection, password: string | null, webContentsId?: number): string {
    const operationId = `backup-${randomUUID()}`
    this.initProgress(operationId)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    this.runBackup(operationId, config, conn, password)
    return operationId
  }

  executeRestore(config: RestoreConfig, conn: SavedConnection, password: string | null, webContentsId?: number): string {
    const operationId = `restore-${randomUUID()}`
    this.initProgress(operationId)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    this.runRestore(operationId, config, conn, password)
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
      // SIGTERM is ignored on Windows; use SIGKILL there
      proc.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM')
      this.runningProcesses.delete(operationId)
      if (progress) this.emitOutputNow(operationId, progress)
      this.requestingWindow.delete(operationId)
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

  private async runBackup(operationId: string, config: BackupConfig, conn: SavedConnection, password: string | null): Promise<void> {
    const progress = this.progressMap.get(operationId)!
    let tempFiles: string[] = []

    try {
      const spec = await this.buildBackupCommand(config, conn, password)
      tempFiles = spec.tempFiles ?? []

      logger.debug('Backup command built', {
        binary: spec.binary,
        database: conn.database,
        argsCount: spec.args.length,
        entitiesCount: config.entities.length,
      })

      this.emitOutputNow(operationId, progress)

      const spawnEnv = buildSpawnEnv(spec.env)
      let proc: ChildProcess
      let outputStreamFinished: Promise<void> | null = null

      const pipesToFile = conn.type === DatabaseType.SQLite
        || conn.type === DatabaseType.DuckDB
        || conn.type === DatabaseType.ClickHouse

      if (pipesToFile) {
        // Pipe stdout to file — avoids shell injection via table names
        const outputStream = createWriteStream(config.outputPath, { highWaterMark: 256 * 1024 })
        proc = spawn(spec.binary, spec.args, { env: spawnEnv })
        outputStream.on('error', (err) => {
          logger.error(`Backup output stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nOutput stream error: ${err.message}`)
          proc.kill()
        })
        proc.stdout?.pipe(outputStream)
        // Wait for the write stream to fully flush before compressing
        outputStreamFinished = new Promise<void>((resolve) => {
          outputStream.on('finish', resolve)
          proc.on('close', () => outputStream.end())
        })
      } else {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv })
      }

      await this.attachAndWait(operationId, proc, progress)
      if (outputStreamFinished) await outputStreamFinished

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
      if (tempFiles.length) await cleanupTempFiles(tempFiles)
    }
  }

  private async runRestore(operationId: string, config: RestoreConfig, conn: SavedConnection, password: string | null): Promise<void> {
    const progress = this.progressMap.get(operationId)!
    let tempFiles: string[] = []

    try {
      // Validate input file exists before spawning the restore process
      if (!config.inputPath || !existsSync(config.inputPath)) {
        throw new Error(`Restore input path does not exist: ${config.inputPath || '(empty)'}`)
      }

      // Auto-decompress ZIP archives (produced by backup with compress=true)
      const { resolvedPath, tempDir } = await decompressIfZip(config.inputPath)
      if (tempDir) {
        tempFiles.push(tempDir)
        config = { ...config, inputPath: resolvedPath }
      }

      const spec = await this.buildRestoreCommand(config, conn, password)
      tempFiles.push(...(spec.tempFiles ?? []))

      this.emitOutputNow(operationId, progress)

      let proc: ChildProcess
      let inputStream: ReturnType<typeof createReadStream> | null = null

      const spawnEnv = buildSpawnEnv(spec.env)

      if (conn.type === DatabaseType.SQLite || conn.type === DatabaseType.DuckDB) {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv, stdio: ['pipe', 'pipe', 'pipe'] })
        inputStream = createReadStream(config.inputPath, { highWaterMark: 256 * 1024 })
        inputStream.on('error', (err) => {
          logger.error(`Restore input stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
          proc.kill()
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
        inputStream = createReadStream(config.inputPath, { highWaterMark: 256 * 1024 })
        inputStream.on('error', (err) => {
          logger.error(`Restore input stream error: ${err.message}`)
          progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
          proc.kill()
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
          inputStream = createReadStream(config.inputPath, { highWaterMark: 256 * 1024 })
          inputStream.on('error', (err) => {
            logger.error(`Restore input stream error: ${err.message}`)
            progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
            proc.kill()
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
      if (tempFiles.length) await cleanupTempFiles(tempFiles)
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
      this.requestingWindow.delete(operationId)
    }, 30_000)
  }

  private emitOutputNow(operationId: string, progress: BackupProgress): void {
    const channel = operationId.startsWith('restore-') ? 'restore:output' : 'backup:output'
    const targetWcId = this.requestingWindow.get(operationId)
    if (targetWcId) {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.id === targetWcId)
      if (win) {
        win.webContents.send(channel, { ...progress })
        return
      }
    }
    // Fallback: broadcast to all (e.g., if requesting window was closed)
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, { ...progress })
      }
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
          // Remove the last extension and add .zip (cross-platform path handling)
          const parsed = parsePath(outputPath)
          const basePath = parsed.ext ? join(parsed.dir, parsed.name) : outputPath
          const finalPath = basePath + '.zip'
          if (zipPath !== finalPath) await rename(zipPath, finalPath)
          // Delete original — handle both files and directories (e.g. mongodump output)
          const origStat = await stat(outputPath)
          if (origStat.isDirectory()) {
            await rm(outputPath, { recursive: true, force: true })
          } else {
            await unlink(outputPath)
          }
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

  private async buildPgDumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
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
    args.push(`--dbname=${conn.database}`, '--format=plain', `--file=${config.outputPath}`)

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

  private async buildMysqldumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for MySQL backup. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
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

  private buildSqlite3DumpCommand(config: BackupConfig, conn: SavedConnection): BackupCommandSpec {
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

  private buildDuckdbDumpCommand(config: BackupConfig, conn: SavedConnection): BackupCommandSpec {
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

  private buildClickHouseDumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): BackupCommandSpec {
    if (!conn.database) {
      throw new Error('Database name is required for ClickHouse backup. Please check your connection settings.')
    }

    // ClickHouse CLI uses native TCP port (default 9000), not HTTP port (8123).
    // SSH tunnels map to the HTTP port, so CLI operations through them won't work.
    if (sshTunnelManager.hasTunnel(config.connectionId)) {
      throw new Error('ClickHouse backup through SSH tunnels is not supported. The CLI requires native TCP port 9000, but SSH tunnels are configured for HTTP port 8123. Please use a direct connection.')
    }

    const tables = config.entities.map(e => e.name)
    // Escape backticks in table names by doubling them (ClickHouse standard)
    const quoteIdent = (name: string): string => '`' + name.replace(/`/g, '``') + '`'
    // Escape single quotes for string literals in WHERE clauses
    const quoteLiteral = (name: string): string => "'" + name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

    // Build restorable SQL backup:
    //   DDL: query system.tables for CREATE TABLE + append semicolon (TabSeparatedRaw = raw text)
    //   Data: FORMAT SQLInsert produces INSERT INTO ... VALUES (...) statements
    // The output is a valid multi-statement SQL file restorable via clickhouse-client --multiquery.
    let query: string
    if (tables.length > 0) {
      const parts: string[] = []
      for (const t of tables) {
        parts.push(`SELECT concat(create_table_query, ';\\n') FROM system.tables WHERE database = currentDatabase() AND name = ${quoteLiteral(t)} FORMAT TabSeparatedRaw`)
        parts.push(`SELECT * FROM ${quoteIdent(t)} FORMAT SQLInsert`)
      }
      query = parts.join(';\n')
    } else {
      // Full database dump: export DDL for all non-system tables, then data for each.
      // We use two queries separated by semicolons:
      //   1) DDL from system.tables
      //   2) Data via a single INSERT SELECT for all tables (clickhouse streams this)
      // Note: We cannot dynamically iterate tables in a single --query, so we dump
      // DDL first. Data for individual tables requires per-table queries, which
      // we cannot generate without knowing table names. To keep it simple and
      // correct, the full-dump path exports DDL only. Users should select specific
      // tables for a data-inclusive backup, or use clickhouse-backup tool for full dumps.
      query = `SELECT concat(create_table_query, ';\\n') FROM system.tables WHERE database = currentDatabase() AND engine NOT IN ('SystemLog') FORMAT TabSeparatedRaw`
    }

    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    if (conn.username) args.push('--user', conn.username)
    if (password) env['CLICKHOUSE_PASSWORD'] = password
    // SSL: clickhouse-client uses --secure for TLS connections
    if (conn.ssl) args.push('--secure')
    args.push('--database', conn.database, '--multiquery', '--query', query)
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { CLICKHOUSE_PASSWORD: '********' } : {}) + ` > "${config.outputPath}"`,
    }
  }

  private async buildMongodumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB backup. Please check your connection settings.')
    }

    const env: Record<string, string> = {}
    const tempFiles: string[] = []
    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    // mongodump has no env var for password — use --password (inherent CLI limitation)
    if (password) args.push('--password', password)

    // SSL: mongodump uses --tls and cert file flags
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        if (conn.sslConfig.rejectUnauthorized === false) args.push('--tlsInsecure')
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push(`--tlsCAFile=${ssl.ca}`); tempFiles.push(ssl.ca) }
        // MongoDB --tlsCertificateKeyFile expects a single PEM with both cert and key
        if (ssl.cert && ssl.key) {
          // Append key content to the cert file so MongoDB gets both in one file
          await writeFile(ssl.cert, conn.sslConfig.cert + '\n' + conn.sslConfig.key, { mode: 0o600 })
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert, ssl.key)
        } else if (ssl.cert) {
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert)
        } else if (ssl.key) {
          args.push(`--tlsCertificateKeyFile=${ssl.key}`)
          tempFiles.push(ssl.key)
        }
      }
    }

    args.push('--db', conn.database, `--out=${config.outputPath}`)

    // mongodump --collection only supports a single collection at a time
    if (config.entities.length === 1) {
      args.push('--collection', config.entities[0].name)
    } else if (config.entities.length > 1) {
      logger.warn('MongoDB backup: multiple collections selected — dumping entire database instead', {
        requested: config.entities.length,
        database: conn.database,
      })
    }
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }

  private async buildRedisDumpCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    const args: string[] = []
    const tempFiles: string[] = []
    if (password) env['REDISCLI_AUTH'] = password

    // SSL: redis-cli uses --tls and cert file flags
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push('--cacert', ssl.ca); tempFiles.push(ssl.ca) }
        if (ssl.cert) { args.push('--cert', ssl.cert); tempFiles.push(ssl.cert) }
        if (ssl.key) { args.push('--key', ssl.key); tempFiles.push(ssl.key) }
      }
    }

    args.push('--no-auth-warning', '-h', host, '-p', String(port), '--rdb', config.outputPath)
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}),
    }
  }

  // ── Restore command builders ────────────────────────────────────────────

  private async buildPsqlRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for PostgreSQL restore. Please check your connection settings.')
    }

    const args: string[] = []
    const tempFiles: string[] = []
    if (password) env['PGPASSWORD'] = password

    // SSL: psql uses the same libpq env vars as pg_dump
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
    args.push(`--dbname=${conn.database}`)
    args.push('-f', config.inputPath)

    // psql only supports --single-transaction and --echo-all from our option set.
    // The other options (--no-owner, --clean, --create, etc.) are pg_restore flags
    // and are NOT valid for psql — passing them would cause an immediate error.
    const opts = config.options
    if (opts['single-transaction']) args.push('--single-transaction')
    if (opts['verbose']) args.push('--echo-all')

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { PGPASSWORD: '********' } : {}),
    }
  }

  private async buildMysqlRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for MySQL restore. Please check your connection settings.')
    }

    // mysql reads SQL from stdin: mysql [opts] dbname < file.sql
    // We pipe the file via createReadStream for streaming
    const args: string[] = []
    const tempFiles: string[] = []
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
    args.push(conn.database)

    const opts = config.options
    if (opts['force']) args.push('--force')

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
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
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env: {},
      displayCommand: `${config.binaryPath} "${dbPath}" < "${config.inputPath}"`,
    }
  }

  private buildDuckdbRestoreCommand(config: RestoreConfig, conn: SavedConnection): BackupCommandSpec {
    const dbPath = conn.filepath || conn.database
    if (!dbPath) {
      throw new Error('Database file path is required for DuckDB restore. Please check your connection settings.')
    }

    // duckdb dbpath < file.sql  — same pattern as sqlite3
    const args = [dbPath]
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

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

    if (sshTunnelManager.hasTunnel(config.connectionId)) {
      throw new Error('ClickHouse restore through SSH tunnels is not supported. The CLI requires native TCP port 9000, but SSH tunnels are configured for HTTP port 8123. Please use a direct connection.')
    }

    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    if (conn.username) args.push('--user', conn.username)
    if (password) env['CLICKHOUSE_PASSWORD'] = password
    if (conn.ssl) args.push('--secure')
    args.push('--database', conn.database, '--multiquery')
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { CLICKHOUSE_PASSWORD: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }

  private async buildMongorestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): Promise<BackupCommandSpec> {
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB restore. Please check your connection settings.')
    }

    const env: Record<string, string> = {}
    const tempFiles: string[] = []
    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    if (password) args.push('--password', password)

    // SSL: mongorestore uses the same TLS flags as mongodump
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        if (conn.sslConfig.rejectUnauthorized === false) args.push('--tlsInsecure')
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push(`--tlsCAFile=${ssl.ca}`); tempFiles.push(ssl.ca) }
        // MongoDB --tlsCertificateKeyFile expects a single PEM with both cert and key
        if (ssl.cert && ssl.key) {
          await writeFile(ssl.cert, conn.sslConfig.cert + '\n' + conn.sslConfig.key, { mode: 0o600 })
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert, ssl.key)
        } else if (ssl.cert) {
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert)
        } else if (ssl.key) {
          args.push(`--tlsCertificateKeyFile=${ssl.key}`)
          tempFiles.push(ssl.key)
        }
      }
    }

    args.push('--db', conn.database)

    if (config.isDirectory) {
      args.push(config.inputPath)
    } else {
      args.push(`--archive=${config.inputPath}`)
    }

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }

  private async buildRedisRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number, env: Record<string, string>
  ): Promise<BackupCommandSpec> {
    // redis-cli --pipe reads Redis inline/RESP protocol commands from stdin.
    // Note: RDB files (produced by --rdb backup) cannot be restored via --pipe.
    // RDB restore requires placing the file on the server as dump.rdb and restarting Redis.
    // --pipe mode is for Redis protocol command files (e.g., SET key value\r\n).
    const args: string[] = []
    const tempFiles: string[] = []
    if (password) env['REDISCLI_AUTH'] = password

    // SSL: redis-cli uses --tls and cert file flags
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push('--cacert', ssl.ca); tempFiles.push(ssl.ca) }
        if (ssl.cert) { args.push('--cert', ssl.cert); tempFiles.push(ssl.cert) }
        if (ssl.key) { args.push('--key', ssl.key); tempFiles.push(ssl.key) }
      }
    }

    args.push('--no-auth-warning', '-h', host, '-p', String(port), '--pipe')
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }

  private buildSqlcmdBackupCommand(
    config: BackupConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): BackupCommandSpec {
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

  private buildSqlcmdRestoreCommand(
    config: RestoreConfig, conn: SavedConnection, password: string | null,
    host: string, port: number
  ): BackupCommandSpec {
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

export const backupService = new BackupService()
