/**
 * Uniform command model shared by every backup/restore client (mirrors Beekeeper).
 * - isSql=false: run `mainCommand` (a binary path) with `options` via spawn (shell:false).
 * - isSql=true:  `mainCommand` is a SQL statement run on the active connection
 *                (e.g. SQL Server `BACKUP DATABASE`).
 * - postCommand: an optional follow-up command run after success (e.g. `docker cp`).
 */
export interface CommandInit {
  isSql?: boolean
  env?: Record<string, string>
  mainCommand: string
  options?: string[]
  postCommand?: Command
}

export class Command {
  isSql: boolean
  env: Record<string, string>
  mainCommand: string
  options: string[]
  postCommand?: Command

  constructor(init: CommandInit) {
    this.isSql = init.isSql ?? false
    this.env = init.env ?? {}
    this.mainCommand = init.mainCommand
    this.options = init.options ?? []
    this.postCommand = init.postCommand
  }
}

// ─── Per-dialect client contracts ─────────────────────────────────────────────
//
// During the Phase 2 refactor each dialect's command-building logic moves out of the
// BackupService god-object and into a small client. Clients return the same
// `BackupCommandSpec` the service used before, so `backup.test.ts` stays green.

import type { SavedConnection, BackupConfig, RestoreConfig, BackupCommandSpec } from '@main/types'

/** Inputs the service resolves once (host/port via SSH tunnel, password) before delegating. */
export interface BackupClientContext {
  config: BackupConfig
  conn: SavedConnection
  password: string | null
  host: string
  port: number
}

export interface RestoreClientContext {
  config: RestoreConfig
  conn: SavedConnection
  password: string | null
  host: string
  port: number
}

export interface BackupClient {
  buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec>
}

export interface RestoreClient {
  buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec>
}
