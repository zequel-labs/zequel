import { spawn, type ChildProcess } from 'child_process'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { BrowserWindow } from 'electron'
import archiver from 'archiver'
import { unlink, rename, stat, rm, writeFile, readFile } from 'fs/promises'
import { join, basename, parse as parsePath } from 'path'
import { randomUUID } from 'crypto'
import { logger } from '@main/utils/logger'
import { sshTunnelManager } from './ssh-tunnel'
import { findBinary, BACKUP_BINARY_MAP, RESTORE_BINARY_MAP } from './backup/BinaryFinder'
import { cleanupTempFiles } from './backup/ssl-temp'
import { appendLog, buildSpawnEnv } from './backup/process-args'
import { decompressIfZip } from './backup/archive'
import { commandClientsFor } from './backup/CommandClient'
import { serializeRedis, deserializeRedis } from './backup/native/redis-serializer'
import { serializeClickHouse, deserializeClickHouse } from './backup/native/clickhouse-serializer'
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
const EMIT_THROTTLE_MS = 150

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

/**
 * Delete a partial backup artifact (file or directory) left behind by a cancelled or
 * failed backup, so the user never mistakes a corrupt half-written dump for a valid one.
 * Silent no-op if the path doesn't exist (e.g. SQL Server writes on the remote server).
 */
const deletePartialArtifact = async (outputPath: string): Promise<void> => {
  try {
    const s = await stat(outputPath)
    if (s.isDirectory()) {
      await rm(outputPath, { recursive: true, force: true })
    } else {
      await unlink(outputPath)
    }
  } catch {
    // Nothing to clean up
  }
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
    const client = commandClientsFor(connConfig.type).backup
    if (!client) {
      throw new Error(`Unsupported database type for backup: ${connConfig.type}`)
    }
    return client.buildBackupSpec({ config, conn: connConfig, password, host, port })
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
    return client.buildRestoreSpec({ config, conn: connConfig, password, host, port })
  }

  // ── Execution ───────────────────────────────────────────────────────────

  executeBackup(config: BackupConfig, conn: SavedConnection, password: string | null, webContentsId?: number, driver?: DatabaseDriver): string {
    const operationId = `backup-${randomUUID()}`
    this.initProgress(operationId)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    if (this.usesDriverPath(conn.type) && driver) {
      this.runDriverBackup(operationId, config, conn, driver, this.progressMap.get(operationId)!)
    } else {
      this.runBackup(operationId, config, conn, password)
    }
    return operationId
  }

  executeRestore(config: RestoreConfig, conn: SavedConnection, password: string | null, webContentsId?: number, driver?: DatabaseDriver): string {
    const operationId = `restore-${randomUUID()}`
    this.initProgress(operationId)
    if (webContentsId) this.requestingWindow.set(operationId, webContentsId)
    if (this.usesDriverPath(conn.type) && driver) {
      this.runDriverRestore(operationId, config, conn, driver, this.progressMap.get(operationId)!)
    } else {
      this.runRestore(operationId, config, conn, password)
    }
    return operationId
  }

  /**
   * Dialects with no viable official CLI tool that we back up through the live driver
   * instead of spawning a binary (Redis: SCAN+DUMP/RESTORE+TTL over any connection).
   */
  private usesDriverPath(type: DatabaseType): boolean {
    return type === DatabaseType.Redis || type === DatabaseType.ClickHouse
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

      // Run chained commands sequentially (e.g. one mongodump per selected collection
      // into the same output directory). Stops if a prior command failed/was cancelled.
      if (spec.extraCommands?.length && progress.status === BackupStatus.Completed) {
        for (const extra of spec.extraCommands) {
          if (progress.status !== BackupStatus.Completed) break
          const extraProc = spawn(extra.binary, extra.args, { env: buildSpawnEnv(extra.env) })
          await this.attachAndWait(operationId, extraProc, progress)
        }
      }

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
      // Remove the partial output artifact on cancel/error (deleteOnAbort) so a corrupt
      // half-written dump is never left behind looking like a valid backup.
      if (progress.status === BackupStatus.Error || progress.status === BackupStatus.Cancelled) {
        await deletePartialArtifact(config.outputPath)
      }
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
        // pg_restore directory format (inputAsArg) and psql -f read the input themselves —
        // don't pipe the file to stdin in those cases.
        const usesFileFlag = spec.inputAsArg || spec.args.some(a => a.startsWith('-f') || a.startsWith('--file'))

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

  /** Backup via the live driver (no spawned binary) — e.g. Redis logical JSON dump. */
  private async runDriverBackup(
    operationId: string, config: BackupConfig, conn: SavedConnection,
    driver: DatabaseDriver, progress: BackupProgress
  ): Promise<void> {
    try {
      this.emitOutputNow(operationId, progress)

      let content: string
      if (conn.type === DatabaseType.Redis) {
        progress.stdout = appendLog(progress.stdout, 'Exporting Redis keys via driver...\n')
        this.throttledEmit(operationId, progress)
        content = await serializeRedis(driver as unknown as RedisDriver)
      } else if (conn.type === DatabaseType.ClickHouse) {
        progress.stdout = appendLog(progress.stdout, 'Exporting ClickHouse tables via driver...\n')
        this.throttledEmit(operationId, progress)
        content = await serializeClickHouse(
          driver as unknown as ClickHouseDriver,
          conn.database,
          config.entities.map(e => e.name)
        )
      } else {
        throw new Error(`Driver-based backup is not supported for ${conn.type}`)
      }

      await writeFile(config.outputPath, content, 'utf-8')
      progress.status = BackupStatus.Completed
      progress.stdout = appendLog(progress.stdout, `Backup written to ${config.outputPath}\n`)

      if (config.compress) {
        await this.compressOutput(config.outputPath, operationId, progress)
      }
    } catch (error) {
      if (progress.status !== BackupStatus.Cancelled) {
        progress.status = BackupStatus.Error
        progress.stderr = appendLog(progress.stderr, `\n${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      this.runningProcesses.delete(operationId)
      if (progress.status === BackupStatus.Error || progress.status === BackupStatus.Cancelled) {
        await deletePartialArtifact(config.outputPath)
      }
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
      if (!config.inputPath || !existsSync(config.inputPath)) {
        throw new Error(`Restore input path does not exist: ${config.inputPath || '(empty)'}`)
      }

      const { resolvedPath, tempDir } = await decompressIfZip(config.inputPath)
      if (tempDir) tempFiles.push(tempDir)

      this.emitOutputNow(operationId, progress)
      const content = await readFile(resolvedPath, 'utf-8')

      if (conn.type === DatabaseType.Redis) {
        const result = await deserializeRedis(driver as unknown as RedisDriver, content)
        progress.stdout = appendLog(
          progress.stdout,
          `Restored ${result.successCount} keys${result.errors.length ? ` (${result.errors.length} errors)` : ''}\n`
        )
        if (result.errors.length) {
          progress.stderr = appendLog(progress.stderr, result.errors.join('\n'))
        }
      } else if (conn.type === DatabaseType.ClickHouse) {
        const result = await deserializeClickHouse(driver as unknown as ClickHouseDriver, content)
        progress.stdout = appendLog(
          progress.stdout,
          `Restored ${result.successCount} statements${result.errors.length ? ` (${result.errors.length} errors)` : ''}\n`
        )
        if (result.errors.length) {
          progress.stderr = appendLog(progress.stderr, result.errors.join('\n'))
        }
      } else {
        throw new Error(`Driver-based restore is not supported for ${conn.type}`)
      }

      progress.status = BackupStatus.Completed
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
}

export const backupService = new BackupService()
