/**
 * Integration tests for BackupService against real Docker containers.
 *
 * Each database suite gracefully skips if the container isn't running
 * or the CLI binary (pg_dump, mysqldump, sqlite3, etc.) isn't installed.
 *
 * Run:
 *   docker-compose up -d
 *   npm run test -- src/tests/integration/main/backup-restore.test.ts
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import net from 'net'

// ─── Hoisted mock declarations ───────────────────────────────────────────

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

// ─── Module mocks (Electron-specific only) ───────────────────────────────

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{
      webContents: { id: 1, send: mockSend },
      isDestroyed: () => false,
    }]),
  },
}))

vi.mock('@main/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@main/services/settings', () => ({
  settingsService: { get: vi.fn(() => null) },
}))

vi.mock('@main/services/keychain', () => ({
  keychainService: { getPassword: vi.fn(() => Promise.resolve('zequel')) },
}))

vi.mock('@main/services/ssh-tunnel', () => ({
  sshTunnelManager: { hasTunnel: vi.fn(() => false), getLocalPort: vi.fn(() => null) },
}))

// ─── Imports (after mocks) ───────────────────────────────────────────────

import { backupService } from '@main/services/backup'
import {
  DatabaseType,
  BackupEntityType,
  BackupStatus,
  type SavedConnection,
  type BackupConfig,
  type RestoreConfig,
  type BackupProgress,
} from '@main/types'

// ─── Helpers ─────────────────────────────────────────────────────────────

const isPortOpen = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(2000)
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.connect(port, host)
  })

const makeConnection = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
  id: 'test-conn',
  name: 'Test',
  type: DatabaseType.PostgreSQL,
  host: '127.0.0.1',
  port: 5432,
  database: 'zequel',
  username: 'zequel',
  filepath: null,
  ssl: false,
  sslConfig: null,
  ssh: null,
  color: null,
  environment: null,
  folder: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastConnectedAt: null,
  ...overrides,
})

/** Poll mockSend for a terminal BackupProgress emission matching the operationId. */
const waitForCompletion = (operationId: string, timeoutMs = 30_000): Promise<BackupProgress> =>
  new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      clearInterval(poller)
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for ${operationId}`))
    }, timeoutMs)
    const poller = setInterval(() => {
      for (let i = mockSend.mock.calls.length - 1; i >= 0; i--) {
        const data = mockSend.mock.calls[i][1] as BackupProgress
        if (
          data?.backupId === operationId &&
          (data.status === BackupStatus.Completed || data.status === BackupStatus.Error)
        ) {
          clearInterval(poller)
          clearTimeout(deadline)
          resolve(data)
          return
        }
      }
    }, 50)
  })

// ─── Test suites ─────────────────────────────────────────────────────────

let tmpDir: string

describe('Backup & Restore Integration', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'zequel-backup-integ-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    mockSend.mockClear()
  })

  // ── PostgreSQL ───────────────────────────────────────────────────────

  describe('PostgreSQL', () => {
    let backupBin: string
    let restoreBin: string
    let available = false
    let fullBackupPath: string

    beforeAll(async () => {
      const backup = backupService.detectBackupBinary(DatabaseType.PostgreSQL)
      const restore = backupService.detectRestoreBinary(DatabaseType.PostgreSQL)
      if (!backup.found || !restore.found) {
        console.warn('Skipping PostgreSQL — pg_dump/psql not found')
        return
      }
      backupBin = backup.path!
      restoreBin = restore.path!
      if (!(await isPortOpen('127.0.0.1', 54320))) {
        console.warn('Skipping PostgreSQL — container not running on port 54320')
        return
      }
      available = true
    })

    it('should build backup command with correct arguments', async () => {
      if (!available) return console.warn('Skipping — PostgreSQL not available')

      const conn = makeConnection({ type: DatabaseType.PostgreSQL, port: 54320 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: join(tmpDir, 'pg-cmd-test.sql'),
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const spec = await backupService.buildBackupCommand(config, conn, 'zequel')
      expect(spec.args).toContain('--host')
      expect(spec.args).toContain('--port')
      expect(spec.args.some(a => a.includes('--dbname'))).toBe(true)
    })

    it('should execute full database backup', async () => {
      if (!available) return console.warn('Skipping — PostgreSQL not available')

      fullBackupPath = join(tmpDir, 'pg-full.sql')
      const conn = makeConnection({ type: DatabaseType.PostgreSQL, port: 54320 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: fullBackupPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(fullBackupPath)).toBe(true)
      const content = readFileSync(fullBackupPath, 'utf-8')
      expect(content).toContain('CREATE TABLE')
    }, 30_000)

    it('should execute single-table backup', async () => {
      if (!available) return console.warn('Skipping — PostgreSQL not available')

      const outputPath = join(tmpDir, 'pg-customers.sql')
      const conn = makeConnection({ type: DatabaseType.PostgreSQL, port: 54320 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [{ name: 'customers', type: BackupEntityType.Table }],
        outputPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(outputPath)).toBe(true)
      const content = readFileSync(outputPath, 'utf-8')
      expect(content).toContain('customers')
    }, 30_000)

    it('should execute backup with compression', async () => {
      if (!available) return console.warn('Skipping — PostgreSQL not available')

      const outputPath = join(tmpDir, 'pg-compressed.sql')
      const conn = makeConnection({ type: DatabaseType.PostgreSQL, port: 54320 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath,
        binaryPath: backupBin,
        compress: true,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      // Compression replaces .sql with .zip
      expect(existsSync(join(tmpDir, 'pg-compressed.zip'))).toBe(true)
    }, 30_000)

    it('should execute restore from backup file', async () => {
      if (!available || !fullBackupPath || !existsSync(fullBackupPath)) {
        return console.warn('Skipping — PostgreSQL backup file not available')
      }

      const conn = makeConnection({ type: DatabaseType.PostgreSQL, port: 54320 })
      const config: RestoreConfig = {
        connectionId: conn.id,
        inputPath: fullBackupPath,
        binaryPath: restoreBin,
        isDirectory: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeRestore(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
    }, 30_000)
  })

  // ── MySQL ────────────────────────────────────────────────────────────

  describe('MySQL', () => {
    let backupBin: string
    let restoreBin: string
    let available = false
    let fullBackupPath: string

    beforeAll(async () => {
      const backup = backupService.detectBackupBinary(DatabaseType.MySQL)
      const restore = backupService.detectRestoreBinary(DatabaseType.MySQL)
      if (!backup.found || !restore.found) {
        console.warn('Skipping MySQL — mysqldump/mysql not found')
        return
      }
      backupBin = backup.path!
      restoreBin = restore.path!
      if (!(await isPortOpen('127.0.0.1', 33061))) {
        console.warn('Skipping MySQL — container not running on port 33061')
        return
      }
      available = true
    })

    it('should build backup command with database as positional arg', async () => {
      if (!available) return console.warn('Skipping — MySQL not available')

      const conn = makeConnection({ type: DatabaseType.MySQL, port: 33061 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: join(tmpDir, 'mysql-cmd-test.sql'),
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const spec = await backupService.buildBackupCommand(config, conn, 'zequel')
      // Database name appears as a positional arg
      expect(spec.args).toContain('zequel')
    })

    it('should execute full database backup', async () => {
      if (!available) return console.warn('Skipping — MySQL not available')

      fullBackupPath = join(tmpDir, 'mysql-full.sql')
      const conn = makeConnection({ type: DatabaseType.MySQL, port: 33061 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: fullBackupPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(fullBackupPath)).toBe(true)
      const content = readFileSync(fullBackupPath, 'utf-8')
      expect(content.length).toBeGreaterThan(0)
    }, 30_000)

    it('should execute single-table backup', async () => {
      if (!available) return console.warn('Skipping — MySQL not available')

      const outputPath = join(tmpDir, 'mysql-customers.sql')
      const conn = makeConnection({ type: DatabaseType.MySQL, port: 33061 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [{ name: 'customers', type: BackupEntityType.Table }],
        outputPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(outputPath)).toBe(true)
      const content = readFileSync(outputPath, 'utf-8')
      expect(content).toContain('customers')
    }, 30_000)

    it('should execute restore from backup file', async () => {
      if (!available || !fullBackupPath || !existsSync(fullBackupPath)) {
        return console.warn('Skipping — MySQL backup file not available')
      }

      const conn = makeConnection({ type: DatabaseType.MySQL, port: 33061 })
      const config: RestoreConfig = {
        connectionId: conn.id,
        inputPath: fullBackupPath,
        binaryPath: restoreBin,
        isDirectory: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeRestore(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
    }, 30_000)
  })

  // ── SQLite ───────────────────────────────────────────────────────────

  describe('SQLite', () => {
    const dbPath = resolve(process.cwd(), 'docker/sqlite/zequel.db')
    let binaryPath: string
    let available = false
    let fullBackupPath: string

    beforeAll(() => {
      const binary = backupService.detectBackupBinary(DatabaseType.SQLite)
      if (!binary.found) {
        console.warn('Skipping SQLite — sqlite3 binary not found')
        return
      }
      binaryPath = binary.path!
      if (!existsSync(dbPath)) {
        console.warn('Skipping SQLite — database file not found')
        return
      }
      available = true
    })

    it('should build backup command with .dump', async () => {
      if (!available) return console.warn('Skipping — SQLite not available')

      const conn = makeConnection({
        type: DatabaseType.SQLite,
        host: null,
        port: null,
        username: null,
        database: dbPath,
        filepath: dbPath,
      })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: join(tmpDir, 'sqlite-cmd-test.sql'),
        binaryPath,
        compress: false,
        customArgs: '',
        options: {},
      }

      const spec = await backupService.buildBackupCommand(config, conn, null)
      expect(spec.args.some(a => a.includes('.dump'))).toBe(true)
    })

    it('should execute full database backup', async () => {
      if (!available) return console.warn('Skipping — SQLite not available')

      fullBackupPath = join(tmpDir, 'sqlite-full.sql')
      const conn = makeConnection({
        type: DatabaseType.SQLite,
        host: null,
        port: null,
        username: null,
        database: dbPath,
        filepath: dbPath,
      })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: fullBackupPath,
        binaryPath,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(fullBackupPath)).toBe(true)
      const content = readFileSync(fullBackupPath, 'utf-8')
      expect(content).toContain('CREATE TABLE')
    }, 30_000)

    it('should execute single-table backup', async () => {
      if (!available) return console.warn('Skipping — SQLite not available')

      const outputPath = join(tmpDir, 'sqlite-customers.sql')
      const conn = makeConnection({
        type: DatabaseType.SQLite,
        host: null,
        port: null,
        username: null,
        database: dbPath,
        filepath: dbPath,
      })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [{ name: 'customers', type: BackupEntityType.Table }],
        outputPath,
        binaryPath,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(outputPath)).toBe(true)
      const content = readFileSync(outputPath, 'utf-8')
      expect(content).toContain('customers')
    }, 30_000)

    it('should execute restore to a temp database', async () => {
      if (!available || !fullBackupPath || !existsSync(fullBackupPath)) {
        return console.warn('Skipping — SQLite backup file not available')
      }

      const tempDb = join(tmpDir, 'sqlite-restore-target.db')
      const conn = makeConnection({
        type: DatabaseType.SQLite,
        host: null,
        port: null,
        username: null,
        database: tempDb,
        filepath: tempDb,
      })
      const config: RestoreConfig = {
        connectionId: conn.id,
        inputPath: fullBackupPath,
        binaryPath,
        isDirectory: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeRestore(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(tempDb)).toBe(true)
    }, 30_000)
  })

  // ── MariaDB ──────────────────────────────────────────────────────────

  describe('MariaDB', () => {
    let backupBin: string
    let restoreBin: string
    let available = false
    let fullBackupPath: string

    beforeAll(async () => {
      const backup = backupService.detectBackupBinary(DatabaseType.MariaDB)
      const restore = backupService.detectRestoreBinary(DatabaseType.MariaDB)
      if (!backup.found || !restore.found) {
        console.warn('Skipping MariaDB — mariadb-dump/mariadb binary not found')
        return
      }
      // mysqldump 9.x (the fallback when mariadb-dump is absent) cannot authenticate to
      // MariaDB's mysql_native_password — skip rather than fail on an environment limitation.
      if (!backup.path!.includes('mariadb-dump')) {
        console.warn('Skipping MariaDB — only an incompatible mysqldump fallback is available (install mariadb-dump)')
        return
      }
      backupBin = backup.path!
      restoreBin = restore.path!
      if (!(await isPortOpen('127.0.0.1', 33070))) {
        console.warn('Skipping MariaDB — container not running on port 33070')
        return
      }
      available = true
    })

    it('should execute full database backup', async () => {
      if (!available) return console.warn('Skipping — MariaDB not available')

      fullBackupPath = join(tmpDir, 'mariadb-full.sql')
      const conn = makeConnection({ type: DatabaseType.MariaDB, port: 33070 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: fullBackupPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(fullBackupPath)).toBe(true)
      const content = readFileSync(fullBackupPath, 'utf-8')
      expect(content.length).toBeGreaterThan(0)
    }, 30_000)

    it('should execute single-table backup', async () => {
      if (!available) return console.warn('Skipping — MariaDB not available')

      const outputPath = join(tmpDir, 'mariadb-customers.sql')
      const conn = makeConnection({ type: DatabaseType.MariaDB, port: 33070 })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [{ name: 'customers', type: BackupEntityType.Table }],
        outputPath,
        binaryPath: backupBin,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(outputPath)).toBe(true)
      const content = readFileSync(outputPath, 'utf-8')
      expect(content).toContain('customers')
    }, 30_000)

    it('should execute restore from backup file', async () => {
      if (!available || !fullBackupPath || !existsSync(fullBackupPath)) {
        return console.warn('Skipping — MariaDB backup file not available')
      }

      const conn = makeConnection({ type: DatabaseType.MariaDB, port: 33070 })
      const config: RestoreConfig = {
        connectionId: conn.id,
        inputPath: fullBackupPath,
        binaryPath: restoreBin,
        isDirectory: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeRestore(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
    }, 30_000)
  })

  // ── DuckDB ───────────────────────────────────────────────────────────

  describe('DuckDB', () => {
    const duckdbPath = resolve(process.cwd(), 'docker/duckdb/zequel.duckdb')
    let binaryPath: string
    let available = false
    let fullBackupPath: string

    beforeAll(() => {
      const binary = backupService.detectBackupBinary(DatabaseType.DuckDB)
      if (!binary.found) {
        console.warn('Skipping DuckDB — duckdb binary not found')
        return
      }
      binaryPath = binary.path!
      if (!existsSync(duckdbPath)) {
        console.warn('Skipping DuckDB — database file not found')
        return
      }
      available = true
    })

    it('should execute full database backup', async () => {
      if (!available) return console.warn('Skipping — DuckDB not available')

      fullBackupPath = join(tmpDir, 'duckdb-full.sql')
      const conn = makeConnection({
        type: DatabaseType.DuckDB,
        host: null,
        port: null,
        username: null,
        database: duckdbPath,
        filepath: duckdbPath,
      })
      const config: BackupConfig = {
        connectionId: conn.id,
        entities: [],
        outputPath: fullBackupPath,
        binaryPath,
        compress: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeBackup(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(fullBackupPath)).toBe(true)
      const content = readFileSync(fullBackupPath, 'utf-8')
      expect(content).toContain('CREATE')
    }, 30_000)

    it('should execute restore to a temp database', async () => {
      if (!available || !fullBackupPath || !existsSync(fullBackupPath)) {
        return console.warn('Skipping — DuckDB backup file not available')
      }

      const tempDb = join(tmpDir, 'duckdb-restore-target.duckdb')
      const conn = makeConnection({
        type: DatabaseType.DuckDB,
        host: null,
        port: null,
        username: null,
        database: tempDb,
        filepath: tempDb,
      })
      const config: RestoreConfig = {
        connectionId: conn.id,
        inputPath: fullBackupPath,
        binaryPath,
        isDirectory: false,
        customArgs: '',
        options: {},
      }

      const opId = backupService.executeRestore(config, conn, 'zequel')
      const result = await waitForCompletion(opId)

      expect(result.status).toBe(BackupStatus.Completed)
      expect(existsSync(tempDb)).toBe(true)
    }, 30_000)
  })
})
