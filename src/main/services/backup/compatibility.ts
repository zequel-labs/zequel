import { execFile, spawn } from 'node:child_process'
import { open } from 'node:fs/promises'
import type { DatabaseDriver } from '@main/db/base'
import { buildSpawnEnv } from '@main/services/backup/process-args'

/** Probe the actual executable, including an explicitly selected advanced override. */
export const postgresToolMajor = (binary: string, signal?: AbortSignal): Promise<number> =>
  new Promise((resolve, reject) => {
    execFile(binary, ['--version'], { timeout: 5000, maxBuffer: 16384, env: buildSpawnEnv({}), signal }, (error, stdout) => {
      if (error) { reject(new Error(`Cannot run the PostgreSQL tool. Repair or update Zequel. ${error.message}`)); return }
      const match = stdout.match(/\(PostgreSQL\)\s+(\d+)(?:\.(\d+))?/)
      if (!match) { reject(new Error('The selected executable is not a PostgreSQL tool')); return }
      resolve(Number(match[1]) < 10 ? Number(`${match[1]}.${match[2]}`) : Number(match[1]))
    })
  })

export const postgresServerMajor = async (driver: DatabaseDriver): Promise<number> => {
  const result = await driver.execute('SHOW server_version_num')
  if (result.error) throw new Error(result.error)
  const version = Number(result.rows[0]?.server_version_num)
  if (!Number.isFinite(version) || version < 90000) throw new Error('Unable to determine a supported PostgreSQL server version')
  return version < 100000 ? Math.floor(version / 100) / 100 : Math.floor(version / 10000)
}

export const validatePostgresBackupVersion = (tool: number, server: number): void => {
  if (server > tool) throw new Error(`PostgreSQL ${server} requires pg_dump ${server} or newer. Update Zequel or select a compatible tool in Advanced.`)
  if (tool >= 18 && server < 9.2) throw new Error('The included PostgreSQL tools require PostgreSQL 9.2 or newer')
}

export const validatePostgresRestoreVersion = (source: number, destination: number): void => {
  if (source > destination) throw new Error(`This backup was created from PostgreSQL ${source}. Choose PostgreSQL ${source} or newer as the destination; restoring to ${destination} is not supported.`)
}

/** Read only the dump header; never buffer a potentially multi-gigabyte SQL file. */
export const postgresSqlSourceMajor = async (path: string): Promise<number | undefined> => {
  const file = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(65536)
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
    const match = buffer.subarray(0, bytesRead).toString('utf8').match(/^-- Dumped from database version (\d+)(?:\.(\d+))?/m)
    return match ? Number(match[1]) < 10 ? Number(`${match[1]}.${match[2]}`) : Number(match[1]) : undefined
  } finally { await file.close() }
}

/** pg_restore validates the complete TOC without connecting to or changing a database. */
export const inspectPostgresArchive = (binary: string, path: string, signal?: AbortSignal): Promise<number | undefined> =>
  new Promise((resolve, reject) => {
    // Do not collect the TOC: retain only its small header, while draining stdout.
    const child = spawn(binary, ['--list', path], { timeout: 30000, env: buildSpawnEnv({}), signal, stdio: ['ignore', 'pipe', 'pipe'] })
    let header = ''
    let errors = ''
    child.stdout?.on('data', (chunk: Buffer) => { if (header.length < 8192) header += chunk.toString().slice(0, 8192 - header.length) })
    child.stderr?.on('data', (chunk: Buffer) => { errors = (errors + chunk.toString()).slice(-8192) })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) { reject(new Error(`Cannot read this PostgreSQL archive with the selected tools. ${errors.trim()}`)); return }
      const match = header.match(/Dumped from database version: (\d+)(?:\.(\d+))?/)
      resolve(match ? Number(match[1]) < 10 ? Number(`${match[1]}.${match[2]}`) : Number(match[1]) : undefined)
    })
  })
