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

**We mirror Beekeeper Studio's backup architecture closely**, adapted to our stack (Vue 3
+ Pinia instead of their Vuex; our existing IPC layer) and **extended** to cover Redis and
ClickHouse, which Beekeeper leaves as `NotImplementedBackupClient`. The naming and patterns
below intentionally match Beekeeper so the reference maps 1:1.

New tree under `src/main/services/backup/`:

```
src/main/services/backup/
├── index.ts                  # Public API — same signatures ipc/backup.ts already imports
├── CommandClient.ts          # commandClientsFor(dialect) → { backup, restore } factory
├── BaseCommandClient.ts      # Abstract base: common flow + shared setting sections
├── models.ts                 # Command, CommandSettingSection/Control, BackupFormat, etc.
├── orchestrator.ts           # Runs the chosen client; manages operations/progress/cancel
├── BinaryFinder.ts           # Binary detection (extracted from current findBinary)
├── compression.ts            # zip/unzip via archiver (only when no native compression)
├── manifest.ts               # Write/read backup manifest.json
├── types.ts                  # BackupConfig, BackupMethod, BackupManifest, ProgressEvent
├── backup-clients/
│   ├── postgresql.ts         # PostgresBackupClient
│   ├── mysql.ts              # MySqlBackupClient (MySQL + MariaDB)
│   ├── sqlite.ts
│   ├── duckdb.ts
│   ├── sqlserver.ts
│   ├── mongodb.ts
│   ├── clickhouse.ts         # driver-based (extends our coverage beyond Beekeeper)
│   └── redis.ts              # driver-based (extends our coverage beyond Beekeeper)
├── restore-clients/
│   ├── postgresql.ts         # PostgresRestoreClient
│   ├── mysql.ts
│   ├── ... (one per dialect, mirroring backup-clients)
└── native/
    └── serializers.ts        # Extended-JSON (Mongo), JSON+TTL/DUMP (Redis) — from export.ts
```

Mirrored tests:
- `src/tests/unit/main/backup/` — per-client unit tests.
- `src/tests/integration/backup/` — round-trip tests.

### Responsibilities

- **`index.ts`** — keeps exactly the functions `src/main/ipc/backup.ts` imports today
  (`executeBackup`, `executeRestore`, `detectBinary`, `getEntities`, `buildCommand`,
  `cancel`, binary-path getters/setters). Zero IPC-contract change.
- **`CommandClient.ts`** — `commandClientsFor(dialect)` factory returning
  `{ backup, restore }` clients for a dialect (mirrors Beekeeper's `CommandClient.ts`).
  Unknown dialects return a `NotImplemented` client — but unlike Beekeeper, Redis and
  ClickHouse ARE implemented.
- **`BaseCommandClient`** — abstract base owning the common flow (build → spawn with
  `shell: false` → await → compress) and the shared setting sections (`fileSettings`,
  `binaryLocation`). Each dialect subclass implements `buildCommand()` and a
  `settingsSections` getter (see "Per-dialect option schemas").
- **`Command`** (in `models.ts`) — uniform model `{ isSql, env, mainCommand, options[],
  postCommand? }` for external-binary, SQL-native (SQL Server `BACKUP DATABASE`), and
  chained commands (`postCommand`, e.g. `docker cp`).
- **`orchestrator.ts`** — applies the method rule (official tool vs driver), runs the
  chosen client, emits throttled structured progress, handles cancellation.
- **`backup-clients/redis.ts` & `clickhouse.ts`** — driver-based clients (our extension).
  They reuse `native/serializers.ts`, which absorbs the native Redis (JSON+TTL via
  `DUMP`/`RESTORE`) and Mongo (Extended-JSON) logic currently in `ipc/export.ts:660+`.

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

Each backup database exposes its own options. Following Beekeeper exactly, **each client
declares a `settingsSections` getter** returning `CommandSettingSection[]`, and
`StepConfigure.vue` renders the controls dynamically — no per-dialect branching in the
component. Defaults are pre-filled in the getter (e.g. `if (!config.format)
config.format = 'c'`).

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
(output/input path, filename with date default, isDir) and `binaryLocation` (tool
selection + filepicker, shown only when relevant). Dialect getters prepend these.

### Options per database

- **PostgreSQL** (`pg_dump` / `pg_restore`) — *section shown only if tool resolves to
  `pg_dump`*:
  - format (select): Custom `c` *(default)* / Directory `d` / Tar `t` / Plain `p`
  - encoding (select): **default `UTF8`**
  - compression (select 0–9; hidden when format = `t`)
  - parallel jobs `-j` (number; shown for format `d`) — *our addition*
  - SQL INSERT instead of COPY (checkbox); no privileges; discard owners; add drop
    database; add create database; data-only / schema-only (mutually exclusive via `show`)
- **MySQL / MariaDB** (`mysqldump` / `mariadb-dump`):
  - character set `--default-character-set` (select, **default `utf8mb4`** — MySQL's
    `utf8` is `utf8mb3` and drops emoji/4-byte chars)
  - `--single-transaction` (checkbox, **default on**)
  - `--routines`, `--triggers`, `--events`, `--add-drop-table`
  - no-data (schema only) / no-create-info (data only)
- **MongoDB** (`mongodump` / `mongorestore`):
  - `--gzip` (checkbox, **default on**)
  - `--numParallelCollections` (number) — native parallelism
  - per-collection vs full database
  - `--archive` single-file vs directory output
- **SQLite** (`sqlite3` `.dump`): data-only, schema-only, preserve-rowids, nosys
- **DuckDB** (`duckdb` `.dump` / `EXPORT DATABASE`): data-only, schema-only; note `.dump`
  has no table filter (use `EXPORT DATABASE` when entities are selected)
- **SQL Server** (`sqlcmd` `BACKUP DATABASE`, native `.bak`): compression; encryption
  (algorithm select + key); Docker copy-to-host (`postCommand` = `docker cp`)
- **ClickHouse** *(driver — our extension)*: entities to include; DDL + data vs DDL only;
  runs over HTTP so it works through SSH tunnels
- **Redis** *(driver — our extension)*: include TTL (checkbox, **default on**); key
  pattern filter (input, default `*`); uses `SCAN` + `DUMP`/`RESTORE` + `PTTL`

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
- **Inheritance leakage** in `BaseCommandClient` — keep dialect-specific logic in
  subclasses; the base only owns the common flow and shared setting sections.
- **Round-trip tests depend on Docker** — must skip gracefully in CI without containers.

## Rollout

Single feature branch (`refactor/backup-restore-overhaul`), landed in reviewable chunks:
1. Extract `Command`, `BinaryFinder`, `compression`, `types` (no behavior change).
2. Introduce `BaseCommandClient` + per-dialect clients (`backup-clients/`,
   `restore-clients/`, `CommandClient.ts` factory), route `index.ts` through them.
3. Add `orchestrator` method-selection + `native/` path + manifest.
4. Add per-dialect option schemas + native formats/parallelism; render them dynamically
   in `StepConfigure.vue`.
5. Fix the five bugs (covered by new round-trip tests).
6. Rebuild `StepExecute.vue` into the progress screen.
