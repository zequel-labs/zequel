# Transfer validation — 20 October 2026

Branch: `refactor/backup-restore-overhaul`, PR #41. No release or merge performed.

## Local execution

- Node 26.10.0; Electron 33.4.11 (its embedded runtime is separate).
- Main/renderer typecheck, complete unit suite, application build and VitePress build pass.
- Isolated nine-engine round trips cover PostgreSQL 18, MySQL 8.4, MariaDB 11, MongoDB 8, Redis 7, SQL Server 2022, ClickHouse 24, SQLite and DuckDB. PostgreSQL includes plain/custom/directory ZIP archives. Fixtures include views, routines, triggers, exact numerics, BSON/indexes and Redis stream consumer groups/pending entries.
- Packaged macOS ARM64 tests use a restricted PATH: included clients, SQLite/DuckDB round trips, standalone PostgreSQL UI and native restore cancellation. Profiles and databases are temporary and isolated.
- Row CSV/JSON round trips cover BIGINT, DECIMAL, binary, timestamp microseconds, JSONB, multiline quoting, NULL, empty strings and literal NULL markers. A failed import after clearing data rolls back; cancellation from another window after closing the editor preserves transactional data.
- Light/dark screenshots and keyboard activation were inspected, including the 800×600 minimum window.
- Six tool payloads are built and hash/architecture checked locally. macOS ARM64 and Linux x64/ARM64 executables were run. Windows and macOS Intel runtime verification requires native CI; static checks are not runtime evidence.
- Corresponding client source archive and Linux x64/ARM64 copyleft dependency source archives were generated with checksums.

- Real PostgreSQL backup/restore through an isolated SSH server with TLS verify-full passed; a mismatched certificate hostname is rejected. SSH initialization failures now close the pending listener/client.
- Safe mode guards table import/clipboard writes; privacy mode masks import previews. Standalone restore is a separate operation with explicit review, not an editor-session write. SQL scripts are explicitly identified as program execution using the account permissions; selected database is not claimed as an isolation boundary.

## Updated scale measurements

macOS ARM64; isolated PostgreSQL; CSV import and JSON export; dedicated transactional import connection. These are local measurements, not cross-platform guarantees.

| Rows | Import | Export | Peak main RSS | Max main event-loop delay |
| --- | --- | --- | --- | --- |
| 10,000 | 207 ms | 49 ms | 173 MiB | 7 ms |
| 100,000 | 1,396 ms | 497 ms | 190 MiB | 4 ms |
| 1,000,000 | 14,297 ms | 3,437 ms | 198 MiB | 8 ms |

The million-row files were 80.9 MB CSV and 109.9 MB JSON. Generated fixtures and measurements are retained outside the repository. `transfer-scale.test.ts` reproduces the measurements with `ZEQUEL_TRANSFER_SCALE=1` and an explicit isolated PostgreSQL port.

## Remaining gates

Native CI on all six supported targets, remaining TLS combinations and signed/notarized release artifacts and final checklist/PR synchronization remain separate gates. Release credentials are not exercised by an unsigned local package. Do not interpret this report as claiming every plan item complete.
