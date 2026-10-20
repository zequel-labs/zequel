import { inspectPostgresArchive, postgresServerMajor, postgresSqlSourceMajor, postgresToolMajor, validatePostgresBackupVersion, validatePostgresRestoreVersion } from '@main/services/backup/compatibility'
import { createDuckDBSnapshot } from '@main/services/backup/native/duckdb-snapshot'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { BrowserWindow } from 'electron'
import archiver from 'archiver'
import { unlink, stat, rm, writeFile, readFile } from 'fs/promises'
import { join, basename, dirname, parse as parsePath } from 'path'
import { createBackupArtifact, type BackupArtifact } from '@main/services/backup/artifacts'
import { randomUUID } from 'crypto'
import { logger } from '@main/utils/logger'
import { sshTunnelManager } from './ssh-tunnel'
import { findBinary, BACKUP_BINARY_MAP, RESTORE_BINARY_MAP } from './backup/BinaryFinder'
import { cleanupTempFiles } from './backup/ssl-temp'
import { appendLog, buildSpawnEnv } from './backup/process-args'
import { decompressIfZip } from './backup/archive'
import { commandClientsFor } from './backup/CommandClient'
import { deserializeRedis } from './backup/native/redis-serializer'
import { writeClickHouseArchive, restoreClickHouseArchive } from './backup/native/clickhouse-serializer'
import { writeRedisArchive, inspectRedisArchive, restoreRedisArchive } from '@main/services/backup/native/redis-archive'
import type { DatabaseDriver } from '@main/db/base'
import type { RedisDriver } from '@main/db/redis'
import type { ClickHouseDriver } from '@main/db/clickhouse'
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
} from '@main/types'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Throttle IPC emission interval in ms */
const EMIT_THROTTLE_MS = 200

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Service ────────────────────────────────────────────────────────────────

class BackupService {
  private runningProcesses = new Map<string, ChildProcess>()
  private progressMap = new Map<string, BackupProgress>()
  private emitTimers = new Map<string, NodeJS.Timeout>()
  private requestingWindow = new Map<string, number>()
  private controllers = new Map<string, AbortController>()
  private resourceCleanup = new Map<string, () => Promise<void>>()
  private serverCancellation = new Map<string, () => Promise<void>>()
  private pendingCancellation = new Map<string, Promise<void>>()

  private configureServerCancellation(id: string, conn: SavedConnection, driver?: DatabaseDriver): void {
    if (conn.type !== DatabaseType.PostgreSQL || !driver) return
    this.serverCancellation.set(id, async () => {
      const result = await driver.execute('SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = ? AND pid <> pg_backend_pid()', [id])
      if (result.error) throw new Error(result.error)
    })
  }

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
    const client = commandClientsFor(connConfig.type).backup
    if (!client) {
      throw new Error(`Unsupported database type for backup: ${connConfig.type}`)
    }
    const tempFiles: string[] = []
    try { return await client.buildBackupSpec({ config, conn: connConfig, password, host, port, tempFiles }) }
    catch (error) { await cleanupTempFiles(tempFiles); throw error }
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
    const client = commandClientsFor(connConfig.type).restore
    if (!client) {
      throw new Error(`Unsupported database type for restore: ${connConfig.type}`)
    }
    const tempFiles: string[] = []
    try { return await client.buildRestoreSpec({ config, conn: connConfig, password, host, port, tempFiles }) }
    catch (error) { await cleanupTempFiles(tempFiles); throw error }
  }

  // ── Execution ───────────────────────────────────────────────────────────

  prepareTransfer(
    mode: 'backup' | 'restore', conn: SavedConnection, webContentsId: number,
    prepare: (signal: AbortSignal) => Promise<(operationId: string) => void>,
    release: () => Promise<void>,
  ): string {
    const id = `${mode}-${randomUUID()}`
    this.initProgress(id)
    const progress = this.progressMap.get(id)!
    Object.assign(progress, { mode, connectionName: conn.name, database: conn.database })
    this.requestingWindow.set(id, webContentsId)
    this.resourceCleanup.set(id, release)
    const signal = this.controllers.get(id)!.signal
    void Promise.resolve().then(() => {
      signal.throwIfAborted()
      return prepare(signal)
    }).then(start => {
      signal.throwIfAborted()
      start(id)
    }).catch(async error => {
      if (!signal.aborted) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, error instanceof Error ? error.message : String(error))
      }
      await this.releaseResources(id)
      this.flushEmit(id, progress)
      this.scheduleCleanup(id)
    })
    return id
  }

  executeBackup(config: BackupConfig, conn: SavedConnection, password: string | null, webContentsId?: number, driver?: DatabaseDriver, release?: () => Promise<void>, preparedId?: string): string {
    const operationId = preparedId || `backup-${randomUUID()}`
    if (!preparedId) this.initProgress(operationId)
    this.configureServerCancellation(operationId, conn, driver)
    Object.assign(this.progressMap.get(operationId)!, { mode: 'backup', connectionName: conn.name, database: conn.database, outputLocation: conn.type === DatabaseType.SQLServer ? 'server' : 'local' })
    if (release) this.resourceCleanup.set(operationId, release)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    if (this.usesDriverPath(conn.type) && driver) {
      this.runDriverBackup(operationId, config, conn, driver, this.progressMap.get(operationId)!)
    } else {
      this.runBackup(operationId, config, conn, password, driver)
    }
    return operationId
  }

  executeRestore(config: RestoreConfig, conn: SavedConnection, password: string | null, webContentsId?: number, driver?: DatabaseDriver, release?: () => Promise<void>, preparedId?: string): string {
    const operationId = preparedId || `restore-${randomUUID()}`
    if (!preparedId) this.initProgress(operationId)
    this.configureServerCancellation(operationId, conn, driver)
    Object.assign(this.progressMap.get(operationId)!, { mode: 'restore', connectionName: conn.name, database: conn.database })
    if (release) this.resourceCleanup.set(operationId, release)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    if (this.usesDriverPath(conn.type) && driver) {
      this.runDriverRestore(operationId, config, conn, driver, this.progressMap.get(operationId)!)
    } else {
      this.runRestore(operationId, config, conn, password, driver)
    }
    return operationId
  }

  /**
   * Dialects with no viable official CLI tool that we back up through the live driver
   * instead of spawning a binary (Redis: SCAN+DUMP/RESTORE+TTL; ClickHouse: HTTP). These
   * need no external binary, so the UI skips binary detection for them.
   */
  usesDriverPath(type: DatabaseType): boolean {
    return type === DatabaseType.Redis || type === DatabaseType.ClickHouse
  }

  /** Preview spec for driver-based dialects: no binary is spawned, so the "command" shown
   *  in the UI is just an explanatory line (avoids a misleading CLI command / SSH error). */
  driverPreviewSpec(type: DatabaseType): BackupCommandSpec {
    return {
      binary: '',
      args: [],
      env: {},
      displayCommand: `${type} runs over the database connection — no external tool required.`,
    }
  }

  cancelOperation(operationId: string): boolean {
    const controller = this.controllers.get(operationId)
    const progress = this.progressMap.get(operationId)
    if (!controller || !progress || progress.status !== BackupStatus.Running) return false
    controller.abort()
    progress.status = BackupStatus.Cancelling
    progress.stderr = appendLog(progress.stderr, '\nCancellation requested. A restore may have applied changes.\n')
    const cancelOnServer = this.serverCancellation.get(operationId)
    if (cancelOnServer) this.pendingCancellation.set(operationId, cancelOnServer().catch(error => {
      progress.stderr = appendLog(progress.stderr, `\nUnable to confirm server cancellation: ${error instanceof Error ? error.message : String(error)}\n`)
    }))
    const proc = this.runningProcesses.get(operationId)
    if (proc) {
      // libpq command-line clients forward SIGINT as a server-side cancellation
      // request. SIGTERM can leave a query running until the server notices EOF.
      const postgres = /^(?:psql|pg_dump|pg_restore)(?:\.exe)?$/i.test(basename(proc.spawnfile || ''))
      proc.kill(process.platform === 'win32' ? 'SIGKILL' : postgres ? 'SIGINT' : 'SIGTERM')
      const timer = setTimeout(() => {
        if (this.runningProcesses.get(operationId) === proc) proc.kill('SIGKILL')
      }, 5000)
      timer.unref()
    }
    this.flushEmit(operationId, progress)
    return true
  }

  listOperations(): BackupProgress[] {
    return Array.from(this.progressMap.values(), progress => ({ ...this.snapshot(progress), stdout: '', stderr: '' }))
  }

  getOperation(id: string): BackupProgress | undefined {
    const progress = this.progressMap.get(id)
    return progress ? this.snapshot(progress) : undefined
  }

  private snapshot(progress: BackupProgress): BackupProgress {
    const finalizing = progress.status === BackupStatus.Completed && this.controllers.has(progress.backupId)
    return { ...progress, status: finalizing ? BackupStatus.Running : progress.status,
      metrics: finalizing ? { phase: 'finalizing' } : progress.metrics ? { ...progress.metrics } : undefined,
      stdout: progress.stdout.slice(-8192), stderr: progress.stderr.slice(-8192) }
  }

  hasRunningOperations(): boolean {
    return this.controllers.size > 0
  }

  async cancelAllAndWait(): Promise<void> {
    for (const id of this.controllers.keys()) this.cancelOperation(id)
    const deadline = Date.now() + 15000
    while (this.hasRunningOperations()) {
      if (Date.now() >= deadline) throw new Error('Some database operations are still stopping. Zequel will remain open to protect their cleanup.')
      await new Promise<void>(resolve => setTimeout(resolve, 50))
    }
  }

  private async releaseResources(operationId: string): Promise<void> {
    await this.pendingCancellation.get(operationId)
    this.pendingCancellation.delete(operationId)
    this.serverCancellation.delete(operationId)
    const release = this.resourceCleanup.get(operationId)
    this.resourceCleanup.delete(operationId)
    if (release) await release().catch(error => logger.warn('Operation resource cleanup failed', error))
    const progress = this.progressMap.get(operationId)
    if (progress?.status === BackupStatus.Cancelling) progress.status = BackupStatus.Cancelled
    if (progress) progress.finishedAt = Date.now()
    this.controllers.delete(operationId)
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private initProgress(operationId: string): void {
    for (const [id, progress] of this.progressMap) {
      if (this.progressMap.size < 50) break
      if (progress.finishedAt) this.progressMap.delete(id)
    }
    this.controllers.set(operationId, new AbortController())
    this.progressMap.set(operationId, {
      backupId: operationId,
      status: BackupStatus.Running,
      stdout: '',
      stderr: '',
      startedAt: Date.now(),
      metrics: { phase: 'preparing' },
    })
  }

  private async runBackup(operationId: string, config: BackupConfig, conn: SavedConnection, password: string | null, driver?: DatabaseDriver): Promise<void> {
    const progress = this.progressMap.get(operationId)!
    let tempFiles: string[] = []
    let sizeTimer: ReturnType<typeof setInterval> | undefined
    let artifact: BackupArtifact | undefined
    const destination = config.compress ? join(parsePath(config.outputPath).dir, parsePath(config.outputPath).name + '.zip') : config.outputPath

    try {
      if (conn.type === DatabaseType.PostgreSQL && driver) {
        const tool = await postgresToolMajor(config.binaryPath, this.controllers.get(operationId)?.signal)
        validatePostgresBackupVersion(tool, await postgresServerMajor(driver))
      }
      this.controllers.get(operationId)?.signal.throwIfAborted()
      if (conn.type !== DatabaseType.SQLServer) {
        artifact = await createBackupArtifact(destination)
        config = { ...config, outputPath: artifact.path }
      } else if (config.compress) {
        throw new Error('SQL Server backups use a server-side path and cannot be compressed locally')
      }
      if (conn.type === DatabaseType.DuckDB && driver) {
        const snapshot = join(dirname(config.outputPath), `${randomUUID()}.duckdb`)
        await createDuckDBSnapshot(driver, snapshot, this.controllers.get(operationId)?.signal)
        conn = { ...conn, filepath: snapshot }
      }
      const spec = await this.buildBackupCommand(config, conn, password)
      tempFiles = spec.tempFiles ?? []
      progress.metrics = { phase: 'transferring' }
      if (conn.type !== DatabaseType.SQLServer) {
        sizeTimer = setInterval(() => {
          void stat(config.outputPath).then(file => {
            if (file.isFile() && progress.metrics?.phase === 'transferring') {
              progress.metrics = { phase: 'transferring', unit: 'bytes', processed: file.size }
            }
          }).catch(() => {})
        }, 500)
        sizeTimer.unref()
      }

      logger.debug('Backup command built', {
        binary: spec.binary,
        database: conn.database,
        argsCount: spec.args.length,
        entitiesCount: config.entities.length,
      })

      this.emitOutputNow(operationId, progress)

      this.controllers.get(operationId)?.signal.throwIfAborted()
      const spawnEnv = buildSpawnEnv({ ...spec.env, ...(conn.type === DatabaseType.PostgreSQL ? { PGAPPNAME: operationId } : {}) })
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
          progress.status = BackupStatus.Error
          progress.stderr = appendLog(progress.stderr, `\nOutput stream error: ${err.message}`)
          proc.kill()
        })
        proc.stdout?.pipe(outputStream)
        proc.stdout?.on('data', (chunk: Buffer) => {
          if (progress.metrics) progress.metrics.processed = (progress.metrics.processed || 0) + chunk.length
        })
        // Wait for the write stream to fully flush before compressing
        outputStreamFinished = new Promise<void>((resolve) => {
          outputStream.on('finish', resolve)
          outputStream.on('error', () => resolve())
          proc.on('close', () => outputStream.end())
        })
      } else {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv })
      }

      await this.attachAndWait(operationId, proc, progress, !pipesToFile)
      if (outputStreamFinished) await outputStreamFinished

      // Run chained commands sequentially (e.g. one mongodump per selected collection
      // into the same output directory). Stops if a prior command failed/was cancelled.
      if (spec.extraCommands?.length && progress.status === BackupStatus.Running) {
        for (const extra of spec.extraCommands) {
          if (progress.status !== BackupStatus.Running) break
          const extraProc = spawn(extra.binary, extra.args, { env: buildSpawnEnv(extra.env) })
          await this.attachAndWait(operationId, extraProc, progress)
        }
      }

      if (progress.status === BackupStatus.Running) {
        let outputPath = config.outputPath
        let finalPath = destination
        if (config.compress) {
          outputPath = await this.compressOutput(config.outputPath, operationId, progress)
          const parsed = parsePath(destination)
          finalPath = join(parsed.dir, parsed.name + '.zip')
        }
        this.controllers.get(operationId)?.signal.throwIfAborted()
        progress.metrics = { phase: 'finalizing' }
        if (artifact) await artifact.publish(outputPath, finalPath)
        progress.outputPath = finalPath
        progress.status = BackupStatus.Completed
      }
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelling) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      if (sizeTimer) clearInterval(sizeTimer)
      this.runningProcesses.delete(operationId)
      if (artifact) await artifact.cleanup().catch(error => logger.warn('Backup staging cleanup failed', error))
      if (tempFiles.length) await cleanupTempFiles(tempFiles)
      await this.releaseResources(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  private async runRestore(operationId: string, config: RestoreConfig, conn: SavedConnection, password: string | null, driver?: DatabaseDriver): Promise<void> {
    const progress = this.progressMap.get(operationId)!
    let tempFiles: string[] = []
    let artifact: BackupArtifact | undefined

    try {
      // Validate input file exists before spawning the restore process
      if (!config.inputPath || (conn.type !== DatabaseType.SQLServer && !existsSync(config.inputPath))) {
        throw new Error(`Restore input path does not exist: ${config.inputPath || '(empty)'}`)
      }

      // Auto-decompress ZIP archives (produced by backup with compress=true)
      const { resolvedPath, tempDir } = conn.type === DatabaseType.SQLServer
        ? { resolvedPath: config.inputPath, tempDir: null }
        : await decompressIfZip(config.inputPath, conn.type, this.controllers.get(operationId)?.signal)
      if (tempDir) {
        tempFiles.push(tempDir)
        config = { ...config, inputPath: resolvedPath, isDirectory: (await stat(resolvedPath)).isDirectory() }
      }

      if ([DatabaseType.SQLite, DatabaseType.DuckDB].includes(conn.type)) {
        artifact = await createBackupArtifact(conn.filepath || conn.database)
        conn = { ...conn, filepath: artifact.path }
      }
      const spec = await this.buildRestoreCommand(config, conn, password)
      tempFiles.push(...(spec.tempFiles ?? []))
      if (conn.type === DatabaseType.PostgreSQL && driver) {
        const source = /^pg_restore(?:\.exe)?$/i.test(basename(spec.binary))
          ? await inspectPostgresArchive(spec.binary, config.inputPath, this.controllers.get(operationId)?.signal)
          : await postgresSqlSourceMajor(config.inputPath)
        if (source !== undefined) validatePostgresRestoreVersion(source, await postgresServerMajor(driver))
      }
      progress.metrics = { phase: 'applying' }

      this.emitOutputNow(operationId, progress)

      let proc: ChildProcess
      let inputStream: ReturnType<typeof createReadStream> | null = null

      this.controllers.get(operationId)?.signal.throwIfAborted()
      const spawnEnv = buildSpawnEnv({ ...spec.env, ...(conn.type === DatabaseType.PostgreSQL ? { PGAPPNAME: operationId } : {}) })

      // MongoDB reads the dump from its args; psql `-f` and pg_restore directory format
      // (inputAsArg) read the input themselves. Everything else streams the file in via stdin.
      const usesFileFlag = spec.inputAsArg || spec.args.some(a => a.startsWith('-f') || a.startsWith('--file'))
      const pipeStdin = conn.type !== DatabaseType.MongoDB && conn.type !== DatabaseType.SQLServer && !usesFileFlag

      if (pipeStdin) {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv, stdio: ['pipe', 'pipe', 'pipe'] })
        inputStream = this.attachInputStream(proc, config.inputPath, progress)
      } else {
        proc = spawn(spec.binary, spec.args, { env: spawnEnv })
      }

      if (inputStream) {
        const stream = inputStream
        proc.on('close', () => stream.destroy())
      }

      await this.attachAndWait(operationId, proc, progress)
      if (progress.status === BackupStatus.Running) {
        this.controllers.get(operationId)?.signal.throwIfAborted()
        if (artifact) {
          progress.metrics = { phase: 'finalizing' }
          progress.outputPath = await artifact.publish(artifact.path)
        }
        progress.status = BackupStatus.Completed
      }
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelling) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      if (artifact) await artifact.cleanup().catch(error => logger.warn('Restore staging cleanup failed', error))
      if (tempFiles.length) await cleanupTempFiles(tempFiles)
      await this.releaseResources(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  /** Backup via the live driver (no spawned binary) — e.g. Redis logical JSON dump. */
  private async runDriverBackup(
    operationId: string, config: BackupConfig, conn: SavedConnection,
    driver: DatabaseDriver, progress: BackupProgress
  ): Promise<void> {
    let artifact: BackupArtifact | undefined
    const destination = config.compress ? join(parsePath(config.outputPath).dir, parsePath(config.outputPath).name + '.zip') : config.outputPath
    try {
      artifact = await createBackupArtifact(destination)
      config = { ...config, outputPath: artifact.path }
      progress.metrics = { phase: 'transferring' }
      this.emitOutputNow(operationId, progress)

      if (conn.type === DatabaseType.Redis) {
        progress.stdout = appendLog(progress.stdout, 'Exporting Redis keys via driver...\n')
        this.throttledEmit(operationId, progress)
        const count = await writeRedisArchive(driver as unknown as RedisDriver, config.outputPath, this.controllers.get(operationId)?.signal, processed => {
          progress.metrics = { phase: 'transferring', unit: 'items', processed }
        })
        progress.stdout = appendLog(progress.stdout, `Exported ${count} keys (including binary data and complete streams).\n`)
      } else if (conn.type === DatabaseType.ClickHouse) {
        progress.stdout = appendLog(progress.stdout, 'Exporting ClickHouse tables via driver...\n')
        this.throttledEmit(operationId, progress)
        await writeClickHouseArchive(driver as ClickHouseDriver, conn.database, config.entities.map(entity => entity.name), config.outputPath,
          this.controllers.get(operationId)?.signal, processed => { progress.metrics = { phase: 'transferring', unit: 'bytes', processed } })
      } else {
        throw new Error(`Driver-based backup is not supported for ${conn.type}`)
      }

      this.controllers.get(operationId)?.signal.throwIfAborted()
      let outputPath = config.outputPath
      let finalPath = destination
      if (config.compress) {
        outputPath = await this.compressOutput(config.outputPath, operationId, progress)
        const parsed = parsePath(destination)
        finalPath = join(parsed.dir, parsed.name + '.zip')
      }
      this.controllers.get(operationId)?.signal.throwIfAborted()
      progress.metrics = { phase: 'finalizing' }
      await artifact.publish(outputPath, finalPath)
      progress.outputPath = finalPath
      progress.status = BackupStatus.Completed
      progress.stdout = appendLog(progress.stdout, `Backup written to ${finalPath}\n`)
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelling) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      if (artifact) await artifact.cleanup().catch(error => logger.warn('Backup staging cleanup failed', error))
      await this.releaseResources(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  /** Restore via the live driver (no spawned binary) — e.g. Redis logical JSON restore. */
  private async runDriverRestore(
    operationId: string, config: RestoreConfig, conn: SavedConnection,
    driver: DatabaseDriver, progress: BackupProgress
  ): Promise<void> {
    let tempFiles: string[] = []
    try {
      if (!config.inputPath || (conn.type !== DatabaseType.SQLServer && !existsSync(config.inputPath))) {
        throw new Error(`Restore input path does not exist: ${config.inputPath || '(empty)'}`)
      }

      const { resolvedPath, tempDir } = conn.type === DatabaseType.SQLServer
        ? { resolvedPath: config.inputPath, tempDir: null }
        : await decompressIfZip(config.inputPath, conn.type, this.controllers.get(operationId)?.signal)
      if (tempDir) tempFiles.push(tempDir)

      this.emitOutputNow(operationId, progress)
      const signal = this.controllers.get(operationId)?.signal
      progress.metrics = { phase: 'applying' }
      if (conn.type === DatabaseType.Redis) {
        const result = await inspectRedisArchive(resolvedPath, signal)
          ? { successCount: await restoreRedisArchive(driver as unknown as RedisDriver, resolvedPath, config.options['replace'] === true, signal,
            processed => { progress.metrics = { phase: 'applying', unit: 'items', processed } }), errors: [] }
          : await deserializeRedis(driver as unknown as RedisDriver, await readFile(resolvedPath, 'utf-8'), signal)
        progress.stdout = appendLog(
          progress.stdout,
          `Restored ${result.successCount} keys${result.errors.length ? ` (${result.errors.length} errors)` : ''}\n`
        )
        if (result.errors.length) {
          progress.stderr = appendLog(progress.stderr, result.errors.join('\n'))
          throw new Error(`Restore applied ${result.successCount} items with ${result.errors.length} errors; the destination may be partially restored`)
        }
      } else if (conn.type === DatabaseType.ClickHouse) {
        const count = await restoreClickHouseArchive(driver as ClickHouseDriver, resolvedPath, signal,
          processed => { progress.metrics = { phase: 'applying', unit: 'items', processed } })
        progress.stdout = appendLog(progress.stdout, `Restored ${count} statements.\n`)
      } else {
        throw new Error(`Driver-based restore is not supported for ${conn.type}`)
      }

      this.controllers.get(operationId)?.signal.throwIfAborted()
      progress.status = BackupStatus.Completed
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelling) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      if (tempFiles.length) await cleanupTempFiles(tempFiles)
      await this.releaseResources(operationId)
      this.flushEmit(operationId, progress)
      this.scheduleCleanup(operationId)
    }
  }

  /** Stream a restore input file into a process's stdin, wiring file/pipe error handling. */
  private attachInputStream(
    proc: ChildProcess, inputPath: string, progress: BackupProgress
  ): ReturnType<typeof createReadStream> {
    const inputStream = createReadStream(inputPath, { highWaterMark: 256 * 1024 })
    progress.metrics = { phase: 'transferring', unit: 'bytes', processed: 0 }
    void stat(inputPath).then(file => {
      if (progress.metrics?.phase === 'transferring') progress.metrics.total = file.size
    }).catch(() => {})
    inputStream.on('data', (chunk: Buffer | string) => {
      if (progress.metrics) progress.metrics.processed = (progress.metrics.processed || 0) + Buffer.byteLength(chunk)
    })
    inputStream.on('end', () => { progress.metrics = { phase: 'applying' } })
    inputStream.on('error', (err) => {
      logger.error(`Restore input stream error: ${err.message}`)
      progress.status = BackupStatus.Error
      progress.stderr = appendLog(progress.stderr, `\nInput file error: ${err.message}`)
      proc.kill()
    })
    inputStream.pipe(proc.stdin!)
    proc.stdin!.on('error', (err) => {
      if (err.message.includes('EPIPE')) return
      logger.warn(`Restore stdin error: ${err.message}`)
    })
    return inputStream
  }

  /** Attach stdout/stderr handlers, store process, and wait for exit. */
  private attachAndWait(operationId: string, proc: ChildProcess, progress: BackupProgress, captureStdout = true): Promise<void> {
    this.runningProcesses.set(operationId, proc)
    if (this.controllers.get(operationId)?.signal.aborted) proc.kill()

    proc.stdout?.on('data', (data: Buffer) => {
      if (!captureStdout) return
      progress.stdout = appendLog(progress.stdout, data.toString())
      this.throttledEmit(operationId, progress)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      progress.stderr = appendLog(progress.stderr, data.toString())
      this.throttledEmit(operationId, progress)
    })

    return new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        if (this.runningProcesses.get(operationId) === proc) this.runningProcesses.delete(operationId)
        progress.exitCode = code ?? undefined
        if (progress.status === BackupStatus.Cancelling) {
          // Cancelled by user — don't override status
          resolve()
        } else if (code === 0 && progress.status !== BackupStatus.Error) {
          resolve()
        } else {
          progress.status = BackupStatus.Error
          reject(new Error(`Process exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        if (progress.status === BackupStatus.Cancelling) return resolve()
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
    this.requestingWindow.delete(operationId)
  }

  private emitOutputNow(operationId: string, progress: BackupProgress): void {
    const channel = operationId.startsWith('restore-') ? 'restore:output' : 'backup:output'
    const targetWcId = this.requestingWindow.get(operationId)
    if (targetWcId) {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.id === targetWcId)
      if (win) {
        win.webContents.send(channel, this.snapshot(progress))
        return
      }
    }
    // Fallback: broadcast to all (e.g., if requesting window was closed)
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, this.snapshot(progress))
      }
    }
  }

  // ── Compression ─────────────────────────────────────────────────────────

  private async compressOutput(outputPath: string, operationId: string, progress: BackupProgress): Promise<string> {
    const zipPath = `${outputPath}.zip`
    const name = basename(outputPath).replace(/\.zip$/i, '.dump')

    progress.stdout = appendLog(progress.stdout, '\nCompressing output...\n')
    progress.metrics = { phase: 'compressing', unit: 'bytes', processed: 0 }
    this.emitOutputNow(operationId, progress)

    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 6 } })
      const signal = this.controllers.get(operationId)?.signal
      const abort = (): void => {
        archive.abort()
        output.destroy()
        reject(signal?.reason || new Error('Compression cancelled'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) { abort(); return }
      archive.on('progress', info => {
        progress.metrics = { phase: 'compressing', unit: 'bytes', processed: info.fs.processedBytes }
        this.throttledEmit(operationId, progress)
      })

      output.on('error', (err) => {
        logger.error(`Compression output stream error: ${err.message}`)
        reject(err)
      })

      output.on('close', async () => {
        signal?.removeEventListener('abort', abort)
        if (signal?.aborted) return
        try {
          // Keep the archive separate from its input inside private staging.
          // Publication chooses the user-facing name after compression succeeds.
          const origStat = await stat(outputPath)
          if (origStat.isDirectory()) {
            await rm(outputPath, { recursive: true, force: true })
          } else {
            await unlink(outputPath)
          }
          progress.stdout = appendLog(progress.stdout, 'Compression finished\n')
          resolve(zipPath)
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
}

export const backupService = new BackupService()
