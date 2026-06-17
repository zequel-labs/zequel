# Backup/Restore Overhaul — Design

- **Date:** 2026-06-16
- **Branch:** `refactor/backup-restore-overhaul`
- **Status:** Approved for planning
- **Reference:** Beekeeper Studio (`~/Herd/beekeeper-studio`). We mirror its backup
  architecture and patterns closely, and deliberately improve on it in three places
  (progress UI, partial-file cleanup, MySQL/SQLite compression) — each called out below.

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

- Refactor `backup.ts` into a maintainable, testable structure (one file per dialect),
  mirroring Beekeeper's `backup-clients/` + `restore-clients/` layout.
- Fix the five runtime bugs above as part of the refactor.
- Replace the command-dump execute screen with a clean progress screen.
- Add backup→restore round-trip integration tests so runtime bugs can't silently return.

## Non-goals

- No redesign of the entity-selection step (beyond mirroring Beekeeper's component split).
- The configure step changes only to render per-dialect options dynamically from each
  client's `settingsSections` — no broader wizard rework.
- No new export formats for the user-facing grid export (CSV/JSON) — that path stays.

## Decisions

1. **Architecture:** abstract `BaseCommandClient` + one client per dialect under
   `backup-clients/` and `restore-clients/`, wired by a `commandClientsFor(dialect)`
   factory — exactly Beekeeper's structure. Adapted to our stack (Vue 3 + Pinia instead of
   Vuex; our IPC layer) and **extended** to cover Redis and ClickHouse, which Beekeeper
   leaves as `NotImplemented`.
2. **Backup method rule:**
   - **General case → official tool always** (`pg_dump`, `mysqldump`, `mongodump`,
     `sqlite3`, `duckdb`, `sqlcmd`). If the tool is **not installed**, **do not back up** —
     show a clear error telling the user to install it. **No automatic driver fallback in
     the general case.**
   - **SSH is NOT a reason to use the driver.** For PostgreSQL, MySQL/MariaDB and MongoDB,
     a connection over SSH already forwards the DB's TCP port to `127.0.0.1:localPort`
     (`ssh-tunnel.ts` + `resolveHostPort()` in `backup.ts:234`). The official tool runs
     **through the tunnel** against `127.0.0.1:localPort` — the fast, optimal path and the
     common production case. Already works today; keep it. (Beekeeper does the same:
     `tunnel.ts` forwards the port, clients inject `--host=localHost --port=localPort`.)
   - **Driver path used ONLY where the official tool cannot viably work:**
     - **Redis** — always. No official remote logical-dump tool exists: `redis-cli --rdb`
       is a binary snapshot only restorable by placing it on the server's disk and
       restarting; `--pipe` speaks RESP, not RDB. Driver uses `SCAN` + `DUMP`/`RESTORE` +
       `PTTL`, which round-trips over any connection (incl. SSH).
     - **ClickHouse** — always. The official CLI needs native TCP 9000 (not tunneled over
       SSH, which forwards HTTP 8123) and has no good logical-dump tool; `.dump` yields DDL
       only. The driver runs over HTTP and works everywhere, incl. through SSH tunnels.
   - **Note:** Beekeeper does **not** implement Redis or ClickHouse backup at all (both
     return `NotImplementedBackupClient`). Our driver clients for these are original work.
3. **Restore detection (no manifest):** mirrors Beekeeper — there is **no metadata/manifest
   file**. The restore client is chosen by the **active connection's dialect**
   (`commandClientsFor(connectionType)`); the user picks the backup file (and, for
   PostgreSQL, whether it's a file or a directory via the `isDir` setting). Format follows
   from the dialect + the user's selection. This drops the manifest entirely from the
   earlier draft.
4. **UI — progress screen (we diverge from Beekeeper here, intentionally):** Beekeeper's
   `BackupProgress.vue` shows the raw command log + start/end timestamps and **no progress
   bar**. We instead show a **progress screen** (the user's explicit request): spinner +
   elapsed time + growing output-file size for the official-tool path, a real
   percentage/ETA bar for the driver path, and the raw command + log moved behind a
   collapsed "Detalhes técnicos" disclosure. IPC handler signatures stay stable.
5. **Partial-file cleanup (we improve on Beekeeper):** on cancel or error, delete the
   partial backup artifact (adopt the `deleteOnAbort` pattern Beekeeper already uses for
   its native export, but apply it to backups too). Beekeeper leaves partial files on disk;
   we don't.
6. **Compression (we extend Beekeeper):** native compression where the tool supports it
   (PostgreSQL `--compress`); **optional gzip for MySQL/SQLite** (a checkbox —
   `mysqldump | gzip`). No outer-zip double compression. Beekeeper compresses only
   PostgreSQL natively and leaves MySQL/SQLite uncompressed.
7. **Testing:** per-client unit tests + Docker round-trip integration tests.

## Architecture

New tree under `src/main/services/backup/`, mirroring Beekeeper's `lib/db` layout
(file and class names match theirs 1:1 except the added Redis/ClickHouse clients):

```
src/main/services/backup/
├── index.ts                  # Public API — same signatures ipc/backup.ts already imports
├── CommandClient.ts          # commandClientsFor(dialect) → { backup, restore } factory
├── BaseCommandClient.ts      # Abstract base: common flow + shared setting sections
├── models.ts                 # Command, CommandSettingSection/Control, BackupFormat, etc.
├── models/
│   └── BackupConfig.ts       # BackupConfig class (mirrors Beekeeper)
├── orchestrator.ts           # Runs the chosen client; progress, cancel, partial cleanup
├── BinaryFinder.ts           # Binary detection (extracted from current findBinary)
├── compression.ts            # gzip helpers (only where used; no double compression)
├── types.ts                  # BackupMethod, ProgressEvent, etc.
├── backup-clients/
│   ├── index.ts              # Re-exports all backup clients
│   ├── postgresql.ts         # PostgresBackupClient
│   ├── mysql.ts              # MySqlBackupClient (mysqldump / mariadb-dump)
│   ├── sqlite.ts             # SqliteBackupClient
│   ├── duckdb.ts             # DuckdbBackupClient
│   ├── sqlserver.ts          # SqlServerBackupClient
│   ├── mongodb.ts            # MongoBackupClient (mongodump)
│   ├── clickhouse.ts         # ClickHouseBackupClient (driver — our extension)
│   ├── redis.ts              # RedisBackupClient (driver — our extension)
│   └── NotImplementedBackupClient.ts
└── restore-clients/
    ├── index.ts              # Re-exports all restore clients
    ├── postgresql.ts         # PostgresRestoreClient (pg_restore / psql, mode='restore')
    ├── mysql.ts
    ├── sqlite.ts
    ├── duckdb.ts
    ├── sqlserver.ts
    ├── mongodb.ts
    ├── clickhouse.ts
    ├── redis.ts
    └── NotImplementedRestoreClient.ts
```

Native serializers (Redis JSON+TTL via `DUMP`/`RESTORE`, Mongo Extended-JSON) live in
`backup-clients/`/`restore-clients/` for Redis/ClickHouse/Mongo and are migrated out of
`ipc/export.ts:660+` (see "export.ts consolidation").

Mirrored tests:
- `src/tests/unit/main/backup/` — per-client unit tests.
- `src/tests/integration/backup/` — round-trip tests.

### Responsibilities

- **`index.ts`** — keeps exactly the functions `src/main/ipc/backup.ts` imports today
  (`executeBackup`, `executeRestore`, `detectBinary`, `getEntities`, `buildCommand`,
  `cancel`, binary-path getters/setters). Zero IPC-contract change.
- **`CommandClient.ts`** — `commandClientsFor(dialect)` returns `{ backup, restore }`.
  Unknown dialects return `NotImplemented*` clients; Redis and ClickHouse ARE implemented.
- **`BaseCommandClient`** — owns the common flow (build → spawn with `shell: false` →
  await → optional compress → cleanup-on-abort) and the shared setting sections
  (`fileSettings`, `binaryLocation`). Each dialect subclass implements `buildCommand()`
  and a `settingsSections` getter.
- **`Command`** (in `models.ts`) — `{ isSql, env, mainCommand, options[], postCommand? }`
  for external-binary, SQL-native (SQL Server `BACKUP DATABASE`), and chained commands
  (`postCommand`, e.g. `docker cp`).
- **`orchestrator.ts`** — applies the method rule, runs the client, emits throttled
  structured progress, handles cancellation, and **deletes the partial artifact on
  cancel/error**.

### Method-selection logic (orchestrator)

```
if dbType in (Redis, ClickHouse):     use driver (always)
else:                                 use official tool
    if official tool not installed:   ERROR — no backup, prompt to install
```

## Bug fixes (folded into the refactor)

| Bug | Fix |
|-----|-----|
| Redis RDB unrestorable | `RedisBackupClient` uses the driver path with `SCAN` + `DUMP`/`RESTORE` + `PTTL`; drop `--rdb`. |
| ClickHouse over SSH | `ClickHouseBackupClient` is always driver (HTTP), which passes through the tunnel. |
| ClickHouse full dump = DDL only | Driver exports DDL **and** data. |
| MongoDB multi-collection silently full-dumps | Loop per collection explicitly; never silently widen scope. |
| Log truncation | Keep head + tail of the log buffer instead of tail only. |

## Dump formats & performance

Native compressed formats and parallelism where the tool supports it.

- **PostgreSQL:** default **custom format `-Fc`** (single file, natively compressed,
  `pg_restore -j N` parallel restore). Offer **directory `-Fd -j N`** (parallel dump *and*
  restore) and **plain SQL** (readable/editable). Native `--compress=<level>`.
- **MySQL/MariaDB:** `mysqldump --single-transaction --quick` (streaming, low memory) with
  an **optional gzip** checkbox (our addition vs Beekeeper).
- **SQLite:** `sqlite3 .dump` with an **optional gzip** checkbox.
- **MongoDB:** `mongodump --gzip --archive=<file>` (single compressed file) +
  `--numParallelCollections`.
- **No double compression:** never wrap a natively-compressed output in an outer zip.

Restore picks the matching tool from the connection's dialect + the user's file/dir
selection (e.g. `pg_restore` for `-Fc`/`-Fd`, `psql` for plain).

## Per-dialect option schemas (dynamic UI)

Following Beekeeper exactly, **each client declares a `settingsSections` getter** returning
`CommandSettingSection[]`; `StepConfigure.vue` renders the controls dynamically — no
per-dialect branching in the component. Defaults are pre-filled in the getter (e.g.
`if (!config.format) config.format = 'c'`).

```ts
interface CommandSettingSection {
  header?: string
  show?: (config: BackupConfig) => boolean        // conditional section visibility
  controls: CommandSettingControl[]
}

interface CommandSettingControl {
  controlType: 'info' | 'select' | 'checkbox' | 'input' | 'number' | 'filepicker'
  settingName?: string                             // key in BackupConfig
  settingDesc?: string                             // label
  selectOptions?: { name: string; value: string }[]
  required?: boolean
  show?: (config: BackupConfig) => boolean         // conditional control visibility
  infoLink?: string; infoLinkText?: string         // for controlType 'info'
}
```

Shared sections live on `BaseCommandClient` (mirroring Beekeeper): `fileSettings`
(output/input path, filename with date default, `isDir`) and `binaryLocation` (tool
selection + filepicker, shown only when relevant). Dialect getters prepend these.

### Options per database

- **PostgreSQL** (`pg_dump` / `pg_restore`) — *section shown only if tool resolves to
  `pg_dump`*:
  - format (select): Custom `c` *(default)* / Directory `d` / Tar `t` / Plain `p`
  - encoding (select): **default `UTF8`**
  - compression (select 0–9; hidden when format = `t`)
  - parallel jobs `-j` (number; shown for format `d`) — *our addition*
  - SQL INSERT instead of COPY; no privileges; discard owners; add drop database; add
    create database; data-only / schema-only (mutually exclusive via `show`)
- **MySQL / MariaDB** (`mysqldump` / `mariadb-dump`):
  - character set `--default-character-set` (select, **default `utf8mb4`** — MySQL's
    `utf8` is `utf8mb3` and drops emoji/4-byte chars)
  - gzip output (checkbox) — *our addition*
  - `--single-transaction` (**default on**), `--routines`, `--triggers`, `--events`,
    `--add-drop-table`, no-data / no-create-info
- **MongoDB** (`mongodump` / `mongorestore`):
  - `--gzip` (**default on**), `--numParallelCollections`, per-collection vs full,
    `--archive` single-file vs directory
- **SQLite** (`sqlite3` `.dump`): gzip output (checkbox); data-only, schema-only,
  preserve-rowids, nosys
- **DuckDB** (`duckdb` `.dump` / `EXPORT DATABASE`): data-only, schema-only; `.dump` has no
  table filter (use `EXPORT DATABASE` when entities are selected)
- **SQL Server** (`sqlcmd` `BACKUP DATABASE`, native `.bak`): encryption (algorithm select
  + key); Docker copy-to-host (`postCommand` = `docker cp`); see remote limitation below
- **ClickHouse** *(driver — our extension)*: entities to include; DDL + data vs DDL only;
  runs over HTTP so it works through SSH tunnels
- **Redis** *(driver — our extension)*: include TTL (**default on**); key pattern filter
  (input, default `*`); uses `SCAN` + `DUMP`/`RESTORE` + `PTTL`

## SQL Server remote limitation (same as Beekeeper)

`BACKUP DATABASE ... TO DISK` writes to the **server's** filesystem, not the client's.
Beekeeper only auto-retrieves the `.bak` for **Docker** servers (via `docker cp` in
`postCommand`); for a non-Docker remote server it cannot bring the file back. We mirror
this exactly: when the connection is remote/Docker, show an `info` control telling the user
to enter the output path manually (or leave empty for the SQL Server default backup
location), and — for Docker — offer the copy-to-host option. This is a documented known
limitation, not a bug.

## UI — progress screen

`StepExecute.vue` (shared by backup and restore) is rebuilt around progress, not command
output. Triggered by an explicit "Iniciar backup" button. **This intentionally diverges
from Beekeeper's `BackupProgress.vue`** (which shows a raw log + timestamps, no bar).

- **Running, driver path (real progress):** determinate bar with `current/total` rows,
  current entity, ETA, elapsed time, Cancel.
- **Running, official-tool path:** spinner + elapsed time + **growing output-file size**
  (an honest progress signal that works without parseable percentages), Cancel. An activity
  line parsed from `--verbose` output when available.
- **Completed:** success card — filename, size, row count — plus "Revelar no Finder" and
  "Novo backup".
- **Error / cancel:** friendly one-line message; **the partial artifact is deleted**;
  "Detalhes técnicos" auto-expanded on error showing the relevant stderr; "Tentar novamente".
- **"Detalhes técnicos" (collapsed by default):** the executed command (with Copy) and the
  raw stdout/stderr log — moved out of the default view.

The orchestrator emits structured progress instead of raw streams:

```ts
interface ProgressEvent {
  phase: 'preparing' | 'running' | 'compressing' | 'done' | 'error' | 'cancelled'
  method: BackupMethod          // 'official' | 'driver'
  currentEntity: string | null
  current: number | null        // null on the official-tool path → indeterminate UI
  total: number | null
  bytesWritten: number | null   // output-file size, for the official-tool path
  rowsPerSec: number | null
  etaSeconds: number | null
}
```

Raw stdout/stderr still flow through (for the technical-details panel and verbose
parsing), throttled as today (~150ms). Component decomposition mirrors Beekeeper's split
(objects → settings → review → progress), adapted to our stepper.

## `export.ts` consolidation

The native Redis (JSON+TTL) and Mongo (Extended-JSON) logic in `ipc/export.ts:660+`
migrates into the Redis/ClickHouse/Mongo backup+restore clients. `export.ts` keeps the
user-facing grid export (CSV/JSON) but stops duplicating backup logic. No duplicated
serialization across the two.

## Testing

- **Unit:** each client tested in isolation (Command assembly, flags, escaping) —
  migrate/expand the current `backup.test.ts`. Add tests for the orchestrator's
  method-selection rule and partial-file cleanup (mocked). Keep the security/exploit
  posture (`shell: false`, password via env var, masked logs, absolute-path validation).
- **Integration (round-trip) in Docker:** for each database — populate → backup →
  drop/clear → restore → assert data is identical. Prioritize Redis, ClickHouse, MongoDB.
  **Seed data must include emoji / 4-byte UTF-8 and other multibyte text** so encoding
  regressions (e.g. MySQL `utf8` vs `utf8mb4`) are caught automatically. Uses the existing
  `docker-compose` setup and skips gracefully when a container is unavailable.

## Risks

- **Hidden coupling** between `backup.ts` and `export.ts` may surface during the migration —
  mitigated by moving serializers first and re-pointing `export.ts` before deleting old code.
- **Inheritance leakage** in `BaseCommandClient` — keep dialect-specific logic in
  subclasses; the base only owns the common flow and shared setting sections.
- **Round-trip tests depend on Docker** — must skip gracefully in CI without containers.
- **SQL Server remote (non-Docker)** cannot retrieve the `.bak` — documented limitation,
  surfaced in the UI.

## Rollout

Single feature branch (`refactor/backup-restore-overhaul`), landed in reviewable chunks:
1. Extract `Command`, `models`, `BackupConfig`, `BinaryFinder` (no behavior change).
2. Introduce `BaseCommandClient` + per-dialect clients (`backup-clients/`,
   `restore-clients/`, `CommandClient.ts` factory), route `index.ts` through them.
3. Add `orchestrator` (method-selection + partial-file cleanup) and migrate the native
   Redis/Mongo serializers; remove the manifest concept.
4. Add per-dialect `settingsSections` + native formats/parallelism/gzip; render them
   dynamically in `StepConfigure.vue`.
5. Fix the five bugs (covered by new round-trip tests).
6. Rebuild `StepExecute.vue` into the progress screen.
