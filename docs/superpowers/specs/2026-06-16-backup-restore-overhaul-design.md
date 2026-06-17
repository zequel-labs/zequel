# Backup/Restore Overhaul — Design

- **Date:** 2026-06-16
- **Branch:** `refactor/backup-restore-overhaul`
- **Status:** Approved for planning

## Problem

The backup/restore system is fragile ("dá vários paus"). Root causes:

1. **Monolithic code.** `src/main/services/backup.ts` is a single 1436-line file with
   `buildXxxCommand()` functions side by side, mixing external-binary logic with
   driver-based fallbacks scattered into `ipc/export.ts`. Hard to maintain; easy to
   break (e.g. MySQL `--tables` argument ordering is fragile by construction).
2. **Runtime bugs no test catches.** Strong unit tests exist for command building
   (`backup.test.ts`, ~7079 lines) but nothing validates a real backup→restore cycle,
   so the worst bugs only surface at runtime:
   - **Redis:** `redis-cli --rdb` produces an RDB file that `redis-cli --pipe` cannot
     restore — the backup is unusable.
   - **ClickHouse over SSH:** native CLI wants TCP 9000, SSH maps HTTP 8123 — fails.
   - **ClickHouse full dump:** exports DDL only, silent data loss.
   - **MongoDB:** >1 collection silently becomes a full-database dump.
   - **Logs:** truncated to last 512KB, losing the start of long errors.
3. **Command-centric UI.** The execute step (`StepExecute.vue`) leads with a raw command
   preview and a raw stdout/stderr log dump — noisy and intimidating.

## Goals

- Refactor `backup.ts` into a maintainable, testable structure (one file per dialect).
- Fix the five runtime bugs above as part of the refactor.
- Replace the command-dump execute screen with a clean progress screen.
- Add backup→restore round-trip integration tests so runtime bugs can't silently return.

## Non-goals

- No redesign of the entity-selection step.
- The configure step changes only to render per-dialect options dynamically from each
  client's schema (see "Per-dialect option schemas") — no broader wizard rework.
- No new export formats for the user-facing grid export (CSV/JSON) — that path stays.

## Decisions

1. **Architecture:** abstract base class + one client per dialect (Approach A, mirrors
   Beekeeper Studio).
2. **Backup method rule:**
   - **General case → official tool always** (`pg_dump`, `mysqldump`, `mongodump`,
     `sqlite3`, `duckdb`, `sqlcmd`). If the tool is **not installed**, **do not back up** —
     show a clear error telling the user to install it. **No automatic driver fallback in
     the general case.**
   - **SSH is NOT a reason to use the driver.** For PostgreSQL, MySQL/MariaDB and MongoDB,
     a connection over SSH already forwards the DB's TCP port to `127.0.0.1:localPort`
     (`ssh-tunnel.ts` + `resolveHostPort()` in `backup.ts:234`). The official tool runs
     **through the tunnel** against `127.0.0.1:localPort` — this is the fast, optimal path
     and the common production case. Already works today; keep it.
   - **Driver path used ONLY where the official tool cannot viably work:**
     - **Redis** — always. There is no official remote logical-dump tool: `redis-cli --rdb`
       produces a binary RDB snapshot that can only be restored by placing it on the
       server's disk and restarting; `--pipe` speaks RESP, not RDB. The driver path uses
       `SCAN` + `DUMP`/`RESTORE` + `PTTL`, which round-trips over any connection (incl. SSH).
     - **ClickHouse over an SSH tunnel** and **ClickHouse data export**. The SSH tunnel
       forwards the HTTP port (8123); `clickhouse-client` needs native TCP 9000, which is
       not tunneled. The driver runs over HTTP, which already passes through the tunnel.
   - **Note:** Beekeeper Studio does **not** implement Redis or ClickHouse backup at all
     (both return `NotImplementedBackupClient`). Our driver path for these is original work,
     not a port of theirs.
3. **UI:** IPC handler signatures stay stable, but the execute step is redesigned into a
   progress screen (this intentionally revises the earlier "UI nearly untouched" scope —
   the user explicitly asked to improve the backup interface). Keep an explicit
   "Iniciar backup" button. Raw command + raw logs move behind a collapsed
   "Detalhes técnicos" disclosure.
4. **Manifest:** every backup embeds a manifest recording the method used; restore reads
   it to auto-select the correct path. Old backups without a manifest fall back to
   extension/content detection.
5. **Testing:** per-client unit tests + Docker round-trip integration tests.

## Architecture

New tree under `src/main/services/backup/`:

```
src/main/services/backup/
├── index.ts                 # Public API — same signatures ipc/backup.ts already imports
├── orchestrator.ts          # Picks official-tool vs driver; manages operations/progress/cancel
├── Command.ts               # Command { isSql, env, mainCommand, options[], postCommand? }
├── BinaryFinder.ts          # Binary detection (extracted from current findBinary)
├── compression.ts           # zip/unzip via archiver (extracted)
├── manifest.ts              # Write/read backup manifest.json
├── types.ts                 # BackupConfig, BackupMethod, BackupManifest, ProgressEvent
├── clients/
│   ├── BaseBackupClient.ts  # Abstract: common flow (build → spawn → await → compress)
│   ├── PostgresBackupClient.ts
│   ├── MysqlBackupClient.ts      # MySQL + MariaDB
│   ├── SqliteBackupClient.ts
│   ├── DuckdbBackupClient.ts
│   ├── ClickHouseBackupClient.ts
│   ├── MongoBackupClient.ts
│   ├── RedisBackupClient.ts
│   └── SqlServerBackupClient.ts
└── native/
    ├── NativeBackupClient.ts # Driver-based path (cursor streaming) for Redis + ClickHouse-SSH
    └── serializers.ts        # Extended-JSON (Mongo), JSON+TTL (Redis) — migrated from export.ts
```

Mirrored tests:
- `src/tests/unit/main/backup/` — per-client unit tests.
- `src/tests/integration/backup/` — round-trip tests.

### Responsibilities

- **`index.ts`** — keeps exactly the functions `src/main/ipc/backup.ts` imports today
  (`executeBackup`, `executeRestore`, `detectBinary`, `getEntities`, `buildCommand`,
  `cancel`, binary-path getters/setters). Zero IPC-contract change.
- **`orchestrator.ts`** — receives config, applies the method rule, runs the chosen
  client, emits throttled structured progress, handles cancellation. Only place that
  knows the method-selection logic.
- **`Command`** — uniform model for external-binary, SQL-native (SQL Server
  `BACKUP DATABASE`), and chained commands (`postCommand`, e.g. `docker cp`). Always
  spawned with `shell: false`.
- **`BaseBackupClient`** — template of the common flow; each subclass implements
  `buildBackupCommand()` / `buildRestoreCommand()` and capability flags
  (`supportsTableFilter`, etc.).
- **`native/`** — the driver path for the exception cases. Absorbs the native Redis
  (JSON+TTL) and Mongo (Extended-JSON) logic currently in `ipc/export.ts:660+`.

### Method-selection logic (orchestrator)

```
if dbType == Redis:                       use driver (always)
elif dbType == ClickHouse and (over SSH or full data export):
                                          use driver
else:                                     use official tool
    if official tool not installed:       ERROR — no backup, prompt to install
```

The chosen method is logged and shown to the user in the final card ("método: X"). No
silent method switches.

## Bug fixes (folded into the refactor)

| Bug | Fix |
|-----|-----|
| Redis RDB unrestorable | `RedisBackupClient` always uses the driver path with `SCAN` + `DUMP`/`RESTORE` + `PTTL`; drop `--rdb`. |
| ClickHouse over SSH | Detect SSH tunnel → route to `NativeBackupClient` (HTTP driver, which passes through the tunnel). |
| ClickHouse full dump = DDL only | Data export goes through the driver path. |
| MongoDB multi-collection silently full-dumps | Loop per collection, or surface an explicit notice; never silently widen scope. |
| Log truncation | Keep head + tail of the log buffer instead of tail only. |

## Dump formats & performance

Adopt native compressed formats and parallelism where the tool supports it — better than
both our current "plain SQL + outer zip" and Beekeeper (which ships no `-j` parallelism).

- **PostgreSQL:** default **custom format `-Fc`** (single file, natively compressed,
  supports `pg_restore -j N` parallel restore). Offer **directory `-Fd -j N`** as an
  advanced "fastest for very large DBs" option (parallel dump *and* restore), and **plain
  SQL** for users who want a readable/editable `.sql`. Native `--compress=<level>`.
- **MySQL/MariaDB:** `mysqldump --single-transaction --quick` (streaming, low memory) with
  compression.
- **MongoDB:** `mongodump --gzip --archive=<file>` (single compressed file) plus
  `--numParallelCollections` (native parallelism).
- **No double compression:** when the tool compresses natively, skip the outer zip and
  stream straight to the file.

The restore path reads the manifest's `format`/`method` and picks the matching tool
automatically (e.g. `pg_restore` for `-Fc`/`-Fd`, `psql` for plain).

## Per-dialect option schemas (dynamic UI)

Each backup database exposes its own options. Rather than hard-coding controls per
dialect in the Vue layer, **each `*BackupClient` declares an option schema** (mirrors
Beekeeper's `CommandSettingSection[]` rendered by `BackupSettings.vue`), and the configure
step renders the controls dynamically with sensible defaults pre-filled.

```ts
interface BackupOption {
  key: string
  label: string
  control: 'select' | 'checkbox' | 'number' | 'text' | 'filepicker'
  default: unknown                 // pre-filled smart default
  options?: { label: string; value: string }[]  // for 'select'
  show?: (config: BackupConfig) => boolean       // conditional visibility
}
```

Examples of per-dialect options:

- **PostgreSQL:** format (`-Fc`/`-Fd`/`-Ft`/plain, default `-Fc`), encoding
  (`--encoding`, **default `UTF8`**), compression level, parallel jobs (`-j`),
  `--no-owner`, `--no-privileges`, `--clean`, `--create`, data-only / schema-only.
- **MySQL/MariaDB:** character set (`--default-character-set`, **default `utf8mb4`** so
  emoji / full Unicode export correctly — note MySQL's `utf8` is really `utf8mb3` and
  drops 4-byte chars), `--single-transaction` (default on), `--routines`, `--triggers`,
  `--events`, `--add-drop-table`, no-data / no-create-info.
- **MongoDB:** `--gzip` (default on), `--numParallelCollections`, per-collection vs full.
- **SQLite / DuckDB:** data-only, schema-only.
- **ClickHouse (driver):** entities to include; DDL + data vs DDL only.
- **Redis (driver):** include TTL (default on), key pattern filter.
- **SQL Server:** native `.bak`, compression, encryption (algorithm + key), Docker
  copy-to-host.

`StepConfigure.vue` consumes the schema from the selected dialect's client and renders it;
no per-dialect branching in the component.

## UI — progress screen

`StepExecute.vue` (shared by backup and restore) is rebuilt around progress, not command
output. Triggered by an explicit "Iniciar backup" button.

- **Running, driver path (real progress):** determinate bar with
  `current/total` rows, current entity, ETA, elapsed time, Cancel.
- **Running, official-tool path (indeterminate):** spinner + activity line parsed from
  `--verbose` output (e.g. "Exportando tabela public.orders"), elapsed time, Cancel.
- **Completed:** success card — filename, size, row count, method — plus "Revelar no
  Finder" and "Novo backup".
- **Error:** friendly one-line message + "Detalhes técnicos" auto-expanded showing the
  relevant stderr, plus "Tentar novamente".
- **"Detalhes técnicos" (collapsed by default):** the executed command (with Copy) and
  the raw stdout/stderr log — moved out of the default view.

The orchestrator emits structured progress instead of raw streams:

```ts
interface ProgressEvent {
  phase: 'preparing' | 'running' | 'compressing' | 'done' | 'error'
  method: BackupMethod          // 'official' | 'driver'
  currentEntity: string | null
  current: number | null        // null on the official-tool path → indeterminate UI
  total: number | null
  rowsPerSec: number | null
  etaSeconds: number | null
}
```

Raw stdout/stderr still flow through (for the technical-details panel and verbose
parsing), throttled as today (~150ms).

## Manifest

Every backup embeds `manifest.json` (inside the zip, or alongside an uncompressed file):

```json
{
  "method": "official",
  "tool": "pg_dump",
  "dbType": "postgresql",
  "entities": ["public.orders", "public.users"],
  "createdAt": "2026-06-16T12:00:00Z",
  "appVersion": "1.2.3",
  "format": "sql"
}
```

Restore reads the manifest and selects the matching path automatically. Backups without a
manifest fall back to extension/content detection (backward compatibility).

## `export.ts` consolidation

The native Redis (JSON+TTL) and Mongo (Extended-JSON) logic in `ipc/export.ts:660+`
migrates to `backup/native/`. `export.ts` keeps the user-facing grid export (CSV/JSON) but
stops duplicating backup logic — it reuses `native/serializers.ts`. No duplicated
serialization across the two.

## Testing

- **Unit:** each `*BackupClient` tested in isolation (Command assembly, flags, escaping) —
  migrate/expand the current `backup.test.ts`. Add tests for the orchestrator's
  method-selection rule (mocked). Keep the security/exploit posture (`shell: false`,
  password via env var, masked logs, absolute-path validation).
- **Integration (round-trip) in Docker:** for each database — populate → backup →
  drop/clear → restore → assert data is identical. Prioritize Redis, ClickHouse, MongoDB.
  **Seed data must include emoji / 4-byte UTF-8 and other multibyte text** so encoding
  regressions (e.g. MySQL `utf8` vs `utf8mb4`) are caught automatically. Uses the existing
  `docker-compose` setup and skips gracefully when a container is unavailable (current
  integration-test convention).

## Risks

- **Hidden coupling** between `backup.ts` and `export.ts` may surface during the
  `native/` migration — mitigated by moving serializers first and re-pointing `export.ts`
  before deleting old code.
- **Inheritance leakage** in `BaseBackupClient` — keep dialect-specific logic in
  subclasses; the base only owns the common flow.
- **Round-trip tests depend on Docker** — must skip gracefully in CI without containers.

## Rollout

Single feature branch (`refactor/backup-restore-overhaul`), landed in reviewable chunks:
1. Extract `Command`, `BinaryFinder`, `compression`, `types` (no behavior change).
2. Introduce `BaseBackupClient` + per-dialect clients, route `index.ts` through them.
3. Add `orchestrator` method-selection + `native/` path + manifest.
4. Add per-dialect option schemas + native formats/parallelism; render them dynamically
   in `StepConfigure.vue`.
5. Fix the five bugs (covered by new round-trip tests).
6. Rebuild `StepExecute.vue` into the progress screen.
