# Backup/Restore Overhaul — Plan 1: Foundational Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure, stateless helpers out of the 1436-line `src/main/services/backup.ts` into focused modules under `src/main/services/backup/`, with **zero behavior change** — all existing `backup.test.ts` tests stay green.

**Architecture:** This is the first of six sequenced plans (see "Subsequent plans"). It only moves code and adds focused unit tests; it does not change the public API, the IPC contract, or any runtime behavior. Later plans introduce `BaseCommandClient`, per-dialect clients, the orchestrator, native Redis/ClickHouse, dynamic options, bug fixes, and the progress UI.

**Tech Stack:** TypeScript (strict), Electron main process, Vitest (globals, mock-based). Arrow functions, single quotes, 2-space indent, `@main/` import alias.

**Spec:** `docs/superpowers/specs/2026-06-16-backup-restore-overhaul-design.md`

---

## ⚠️ Pre-existing blocker (read first)

The Husky pre-commit hook runs `npm run typecheck && npm run test:unit`. Four **pre-existing, unrelated** tests in `src/tests/unit/renderer/utils.test.ts` (`copyToClipboard`, `TypeError: Cannot set property navigator`) currently fail. The user chose not to fix them first. Therefore:

- **All commits in this plan use `git commit --no-verify`.**
- Each task still runs the relevant tests manually (commands given per step) so we never rely on the hook for verification.

## File Structure

Created in this plan (all under `src/main/services/backup/`):

- `BinaryFinder.ts` — binary maps, search dirs, version detection, `findBinary()`. One responsibility: locate the right CLI binary and report version/warning.
- `ssl-temp.ts` — write/cleanup of temporary SSL PEM files + SSLMode→string mappers. One responsibility: turn `SSLConfig` into secure temp files and clean them up.
- `process-args.ts` — `parseCustomArgs`, `formatDisplayCommand`, `appendLog`, `buildSpawnEnv`. One responsibility: argument/string/env helpers for spawning.
- `archive.ts` — `KNOWN_RESTORE_EXTENSIONS`, `decompressIfZip`. One responsibility: zip extraction for restore input.
- `models.ts` — the `Command` model used by later plans. One responsibility: the cross-dialect command shape.

Modified:

- `src/main/services/backup.ts` — remove the moved helpers; import them from the new modules. No other change.

Tests created (mirror `src/tests/unit/main/backup/`):

- `src/tests/unit/main/backup/BinaryFinder.test.ts`
- `src/tests/unit/main/backup/ssl-temp.test.ts`
- `src/tests/unit/main/backup/process-args.test.ts`
- `src/tests/unit/main/backup/archive.test.ts`

The existing `src/tests/unit/main/backup.test.ts` (364 tests) is the regression guard: it must stay green after every task.

---

### Task 1: Extract `process-args.ts` (pure string/arg helpers)

These four helpers are pure and dependency-light, so they go first.

**Files:**
- Create: `src/main/services/backup/process-args.ts`
- Create: `src/tests/unit/main/backup/process-args.test.ts`
- Modify: `src/main/services/backup.ts` (remove the four helpers; import them)

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/main/backup/process-args.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseCustomArgs,
  formatDisplayCommand,
  appendLog,
} from '@main/services/backup/process-args'

describe('parseCustomArgs', () => {
  it('splits on whitespace', () => {
    expect(parseCustomArgs('--a --b')).toEqual(['--a', '--b'])
  })

  it('respects double quotes around spaces', () => {
    expect(parseCustomArgs('--config="/path with spaces/f.ini"')).toEqual([
      '--config=/path with spaces/f.ini',
    ])
  })

  it('respects single quotes', () => {
    expect(parseCustomArgs("--x='a b'")).toEqual(['--x=a b'])
  })

  it('returns empty array for empty input', () => {
    expect(parseCustomArgs('')).toEqual([])
  })
})

describe('formatDisplayCommand', () => {
  it('prefixes env vars and quotes args with spaces', () => {
    const out = formatDisplayCommand('/bin/pg_dump', ['--file=/a b', '--x'], {
      PGPASSWORD: '********',
    })
    expect(out).toBe('PGPASSWORD=******** /bin/pg_dump "--file=/a b" --x')
  })

  it('omits env prefix when env is empty', () => {
    expect(formatDisplayCommand('/bin/x', ['--y'], {})).toBe('/bin/x --y')
  })
})

describe('appendLog', () => {
  it('concatenates under the cap', () => {
    expect(appendLog('a', 'b')).toBe('ab')
  })

  it('truncates and marks when over the cap', () => {
    const big = 'x'.repeat(600 * 1024)
    const out = appendLog('', big)
    expect(out.startsWith('...(truncated)\n')).toBe(true)
    expect(out.length).toBeLessThan(big.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/tests/unit/main/backup/process-args.test.ts`
Expected: FAIL — `Cannot find module '@main/services/backup/process-args'`.

- [ ] **Step 3: Create the module**

Create `src/main/services/backup/process-args.ts` by moving the code verbatim from `backup.ts` (`parseCustomArgs` ~125-148, `formatDisplayCommand` ~249-259, `appendLog` ~261-269, `buildSpawnEnv` ~382-399, and the `MAX_LOG_BYTES` constant ~114):

```typescript
/** Max bytes of stdout/stderr kept in memory per operation */
export const MAX_LOG_BYTES = 512 * 1024 // 512KB

/** Split a custom args string respecting single/double quotes (e.g. --config="/path with spaces/f.ini"). */
export const parseCustomArgs = (input: string): string[] => {
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

export const formatDisplayCommand = (
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
export const appendLog = (current: string, chunk: string): string => {
  const combined = current + chunk
  if (combined.length > MAX_LOG_BYTES) {
    return '...(truncated)\n' + combined.slice(combined.length - MAX_LOG_BYTES + 20)
  }
  return combined
}

/**
 * Build minimal spawn env: only PATH + operation-specific env vars.
 * Avoids leaking the full process.env to child processes.
 */
export const buildSpawnEnv = (extraEnv: Record<string, string>): Record<string, string> => {
  const base: Record<string, string> = {}
  const passthrough = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'TMPDIR', 'TEMP', 'TMP',
    'LANG', 'LC_ALL',
    'SystemRoot',
    'LD_LIBRARY_PATH',
    'DYLD_LIBRARY_PATH',
    'DYLD_FALLBACK_LIBRARY_PATH',
  ]
  for (const key of passthrough) {
    if (process.env[key]) base[key] = process.env[key]!
  }
  return { ...base, ...extraEnv }
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npm run test:unit -- src/tests/unit/main/backup/process-args.test.ts`
Expected: PASS (10 assertions).

- [ ] **Step 5: Update `backup.ts` to import from the new module**

In `src/main/services/backup.ts`: delete the moved definitions (`MAX_LOG_BYTES`, `parseCustomArgs`, `formatDisplayCommand`, `appendLog`, `buildSpawnEnv`) and add an import near the top (after the existing local imports):

```typescript
import {
  MAX_LOG_BYTES,
  parseCustomArgs,
  formatDisplayCommand,
  appendLog,
  buildSpawnEnv,
} from './backup/process-args'
```

- [ ] **Step 6: Run the full regression suite to confirm no behavior change**

Run: `npm run test:unit -- src/tests/unit/main/backup.test.ts`
Expected: PASS (364 tests). Also run `npm run typecheck` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/backup/process-args.ts src/tests/unit/main/backup/process-args.test.ts src/main/services/backup.ts
git commit --no-verify -m "refactor(backup): extract process-args helpers"
```

---

### Task 2: Extract `ssl-temp.ts` (SSL temp files + SSL mode mappers)

**Files:**
- Create: `src/main/services/backup/ssl-temp.ts`
- Create: `src/tests/unit/main/backup/ssl-temp.test.ts`
- Modify: `src/main/services/backup.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/main/backup/ssl-temp.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { SSLMode } from '@main/types'
import { pgSslMode, mysqlSslMode } from '@main/services/backup/ssl-temp'

describe('pgSslMode', () => {
  it('maps known modes', () => {
    expect(pgSslMode(SSLMode.Disable)).toBe('disable')
    expect(pgSslMode(SSLMode.VerifyFull)).toBe('verify-full')
  })
  it('defaults to require', () => {
    expect(pgSslMode(undefined)).toBe('require')
  })
})

describe('mysqlSslMode', () => {
  it('maps verify modes', () => {
    expect(mysqlSslMode(SSLMode.VerifyCA)).toBe('VERIFY_CA')
    expect(mysqlSslMode(SSLMode.VerifyFull)).toBe('VERIFY_IDENTITY')
  })
  it('defaults to REQUIRED', () => {
    expect(mysqlSslMode(undefined)).toBe('REQUIRED')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/tests/unit/main/backup/ssl-temp.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/main/services/backup/ssl-temp.ts` moving `writeSslTempFiles` (~275-302), `cleanupTempFiles` (~305-319), `pgSslMode` (~358-367), and `mysqlSslMode` (~370-376) verbatim, with their imports:

```typescript
import { unlink, writeFile, mkdtemp, rmdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { SSLMode, type SSLConfig } from '@main/types'

/** Write SSL cert/key/ca PEM content to secure temp files for CLI tools. */
export const writeSslTempFiles = async (
  sslConfig: SSLConfig
): Promise<{ ca?: string; cert?: string; key?: string; dir: string }> => {
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
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  return result
}

/** Remove temp SSL files, extraction directories, and their parent directories. */
export const cleanupTempFiles = async (files: string[]): Promise<void> => {
  const parentDirs = new Set<string>()
  for (const f of files) {
    try {
      await unlink(f)
      parentDirs.add(join(f, '..'))
    } catch {
      try { await rm(f, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  for (const d of parentDirs) {
    try { await rmdir(d) } catch { /* ignore — dir may not be empty */ }
  }
}

/** Map SSLMode enum to PostgreSQL sslmode string. */
export const pgSslMode = (mode?: SSLMode): string => {
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
export const mysqlSslMode = (mode?: SSLMode): string => {
  switch (mode) {
    case SSLMode.VerifyCA: return 'VERIFY_CA'
    case SSLMode.VerifyFull: return 'VERIFY_IDENTITY'
    default: return 'REQUIRED'
  }
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npm run test:unit -- src/tests/unit/main/backup/ssl-temp.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `backup.ts`**

Delete the four moved functions from `backup.ts`. Add:

```typescript
import { writeSslTempFiles, cleanupTempFiles, pgSslMode, mysqlSslMode } from './backup/ssl-temp'
```

Then remove now-unused imports from `backup.ts`'s `fs/promises` line if they are no longer referenced elsewhere in the file (check `mkdtemp`, `rmdir` — they are only used by the moved functions; `unlink`, `rename`, `stat`, `writeFile`, `rm`, `readdir` are still used by `compressOutput`/`decompressIfZip`/mongo cert handling, so keep those). Let `npm run typecheck` in Step 6 confirm.

- [ ] **Step 6: Run regression + typecheck**

Run: `npm run test:unit -- src/tests/unit/main/backup.test.ts`
Expected: PASS (364 tests).
Run: `npm run typecheck`
Expected: no errors (fix any unused-import errors it reports).

- [ ] **Step 7: Commit**

```bash
git add src/main/services/backup/ssl-temp.ts src/tests/unit/main/backup/ssl-temp.test.ts src/main/services/backup.ts
git commit --no-verify -m "refactor(backup): extract ssl-temp helpers"
```

---

### Task 3: Extract `archive.ts` (zip decompression)

**Files:**
- Create: `src/main/services/backup/archive.ts`
- Create: `src/tests/unit/main/backup/archive.test.ts`
- Modify: `src/main/services/backup.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/main/backup/archive.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { KNOWN_RESTORE_EXTENSIONS } from '@main/services/backup/archive'

describe('KNOWN_RESTORE_EXTENSIONS', () => {
  it('includes the dump extensions we restore from', () => {
    expect(KNOWN_RESTORE_EXTENSIONS).toEqual(['.sql', '.dump', '.bson', '.rdb', '.bak'])
  })
})
```

(The `decompressIfZip` function does filesystem + `extract-zip` work; its behavior remains covered by the existing `backup.test.ts` restore tests after re-import. This focused test guards the constant; the regression suite guards the function.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/tests/unit/main/backup/archive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/main/services/backup/archive.ts` moving `KNOWN_RESTORE_EXTENSIONS` (~120) and `decompressIfZip` (~326-355) verbatim:

```typescript
import extract from 'extract-zip'
import { mkdtemp, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/** File extensions recognized as restorable database dumps inside ZIP archives. */
export const KNOWN_RESTORE_EXTENSIONS = ['.sql', '.dump', '.bson', '.rdb', '.bak']

/**
 * If the input path is a .zip file, extract it to a temp directory and return
 * the path to the first SQL/dump file inside. Returns the original path unchanged
 * for non-zip files. The caller must clean up `tempDir` when done.
 */
export const decompressIfZip = async (
  inputPath: string
): Promise<{ resolvedPath: string; tempDir: string | null }> => {
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
    if (files.length === 1) {
      return { resolvedPath: join(tempDir, files[0]), tempDir }
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw new Error('No SQL or dump file found inside the ZIP archive.')
  }

  return { resolvedPath: join(tempDir, sqlFile), tempDir }
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npm run test:unit -- src/tests/unit/main/backup/archive.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `backup.ts`**

Delete `KNOWN_RESTORE_EXTENSIONS` and `decompressIfZip` from `backup.ts`. Add:

```typescript
import { decompressIfZip } from './backup/archive'
```

Remove the now-unused `import extract from 'extract-zip'` line from `backup.ts` (it was only used by `decompressIfZip`). `readdir` is now only used here too — verify via typecheck and drop from the `fs/promises` import if unused.

- [ ] **Step 6: Run regression + typecheck**

Run: `npm run test:unit -- src/tests/unit/main/backup.test.ts`
Expected: PASS (364 tests).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/backup/archive.ts src/tests/unit/main/backup/archive.test.ts src/main/services/backup.ts
git commit --no-verify -m "refactor(backup): extract archive (zip) helpers"
```

---

### Task 4: Extract `BinaryFinder.ts` (binary detection)

**Files:**
- Create: `src/main/services/backup/BinaryFinder.ts`
- Create: `src/tests/unit/main/backup/BinaryFinder.test.ts`
- Modify: `src/main/services/backup.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/main/backup/BinaryFinder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn(() => null as string | null) }))
vi.mock('@main/services/settings', () => ({ settingsService: { get: mockGet, set: vi.fn() } }))

const { mockExistsSync, mockExecSync, mockExecFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockExecSync: vi.fn(() => ''),
  mockExecFileSync: vi.fn(() => ''),
}))
vi.mock('fs', () => ({ existsSync: mockExistsSync }))
vi.mock('child_process', () => ({ execSync: mockExecSync, execFileSync: mockExecFileSync }))

import { getMysqlVersionWarning } from '@main/services/backup/BinaryFinder'

describe('getMysqlVersionWarning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('warns for MySQL 9.x', () => {
    expect(getMysqlVersionWarning('9.4.0')).toContain('mysql_native_password')
  })
  it('does not warn for 8.x', () => {
    expect(getMysqlVersionWarning('8.0.36')).toBeNull()
  })
  it('returns null for unknown version', () => {
    expect(getMysqlVersionWarning(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/tests/unit/main/backup/BinaryFinder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/main/services/backup/BinaryFinder.ts` moving `BACKUP_BINARY_MAP` (~29-39), `RESTORE_BINARY_MAP` (~41-51), `getSearchDirs` (~53-111), `detectBinaryVersion` (~151-161), `getMysqlVersionWarning` (~164-174), and `findBinary` (~176-232) verbatim, with imports:

```typescript
import { execSync, execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { settingsService } from '../settings'
import { DatabaseType, type BackupBinaryInfo } from '@main/types'

export const BACKUP_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
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

export const RESTORE_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
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

// getSearchDirs, detectBinaryVersion, getMysqlVersionWarning, findBinary:
// MOVE VERBATIM from backup.ts lines 53-111, 151-161, 164-174, 176-232.
// Add `export` to each. They reference only the imports above.
```

> Worker note: copy the four function bodies exactly as they appear in `backup.ts` at the cited line ranges, prefixing each with `export`. Do not paraphrase — they contain platform-specific path lists and escaping that must not drift.

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npm run test:unit -- src/tests/unit/main/backup/BinaryFinder.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `backup.ts`**

Delete `BACKUP_BINARY_MAP`, `RESTORE_BINARY_MAP`, `getSearchDirs`, `detectBinaryVersion`, `getMysqlVersionWarning`, `findBinary` from `backup.ts`. Add:

```typescript
import { findBinary, BACKUP_BINARY_MAP, RESTORE_BINARY_MAP } from './backup/BinaryFinder'
```

Remove now-unused imports from `backup.ts`: `execSync`, `execFileSync` (from `child_process` — keep `spawn` and `ChildProcess`). Verify with typecheck.

- [ ] **Step 6: Run regression + typecheck**

Run: `npm run test:unit -- src/tests/unit/main/backup.test.ts`
Expected: PASS (364 tests).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/backup/BinaryFinder.ts src/tests/unit/main/backup/BinaryFinder.test.ts src/main/services/backup.ts
git commit --no-verify -m "refactor(backup): extract BinaryFinder"
```

---

### Task 5: Add the `Command` model (`models.ts`)

This adds the cross-dialect command shape used by every client in Plan 2. It is additive — nothing imports it yet, so there is no behavior change.

**Files:**
- Create: `src/main/services/backup/models.ts`
- Create: `src/tests/unit/main/backup/models.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/main/backup/models.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Command } from '@main/services/backup/models'

describe('Command', () => {
  it('builds a shell command with defaults', () => {
    const c = new Command({ mainCommand: '/bin/pg_dump', options: ['--x'] })
    expect(c.isSql).toBe(false)
    expect(c.env).toEqual({})
    expect(c.options).toEqual(['--x'])
    expect(c.postCommand).toBeUndefined()
  })

  it('builds a SQL command', () => {
    const c = new Command({ isSql: true, mainCommand: 'BACKUP DATABASE [x] TO DISK = N\'/p\'' })
    expect(c.isSql).toBe(true)
    expect(c.options).toEqual([])
  })

  it('chains a postCommand', () => {
    const post = new Command({ mainCommand: 'docker', options: ['cp', 'a', 'b'] })
    const c = new Command({ mainCommand: '/bin/sqlcmd', options: ['-Q'], postCommand: post })
    expect(c.postCommand).toBe(post)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/tests/unit/main/backup/models.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/main/services/backup/models.ts`:

```typescript
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
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npm run test:unit -- src/tests/unit/main/backup/models.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full unit suite + typecheck**

Run: `npm run test:unit`
Expected: the backup module suites pass; the only failures are the 4 pre-existing `utils.test.ts` `copyToClipboard` cases (unchanged by this plan).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/backup/models.ts src/tests/unit/main/backup/models.test.ts
git commit --no-verify -m "refactor(backup): add Command model"
```

---

## Self-Review

- **Spec coverage:** This plan implements the "extract `Command`, `models`, `BinaryFinder`"
  portion of Rollout step 1. `BackupConfig` extraction is deferred to Plan 2 (it changes
  shape there, so moving it now then reshaping would be churn). All other spec sections are
  later plans (see roadmap).
- **No behavior change:** every task ends by running `backup.test.ts` (364 tests) green.
- **Type consistency:** `Command`/`CommandInit` here match the shape referenced in the spec
  (`{ isSql, env, mainCommand, options[], postCommand? }`) and will be consumed unchanged in
  Plan 2.
- **Placeholders:** the one "MOVE VERBATIM" note (Task 4, Step 3) is a deliberate
  instruction to copy platform-specific code exactly rather than risk transcription drift —
  the line ranges are exact.

---

## Subsequent plans (roadmap — each its own plan file when reached)

2. **`plan-2-clients.md`** — Introduce `BaseCommandClient`, `models/BackupConfig.ts`,
   `CommandClient.ts` (`commandClientsFor`), and per-dialect `backup-clients/` +
   `restore-clients/` (PG, MySQL, SQLite, DuckDB, SQL Server, Mongo) that reproduce today's
   exact commands. Route `backup.ts` through the factory. Regression: `backup.test.ts`.
3. **`plan-3-orchestrator-native.md`** — `orchestrator.ts` (method-selection rule +
   partial-file cleanup on cancel/error), driver-based `redis.ts` & `clickhouse.ts` clients,
   migrate native serializers out of `ipc/export.ts`. Remove the manifest concept (n/a).
4. **`plan-4-options.md`** — `settingsSections` per client (formats, encoding, parallel
   `-j`, `utf8mb4`, gzip for MySQL/SQLite), render dynamically in `StepConfigure.vue`.
5. **`plan-5-bugfixes-roundtrip.md`** — fix the five bugs; add Docker round-trip
   integration tests (with emoji/multibyte seed data) under `src/tests/integration/backup/`.
6. **`plan-6-progress-ui.md`** — rebuild `StepExecute.vue` into the progress screen
   (structured `ProgressEvent`, "Detalhes técnicos" disclosure, growing file size).
