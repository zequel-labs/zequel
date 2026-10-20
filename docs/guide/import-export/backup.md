# Backup and Restore

Backup and restore run in separate windows with their own connections. You can start from the home screen or application menu without opening a database editor. Disconnecting an editor or closing the operation window does not stop a running job; reopen Backup or Restore to see it again.

## Back up a database

1. Open **Backup** and choose a saved connection.
2. Select the database and destination file. PostgreSQL offers SQL and custom archives; optional ZIP compression is available for local backups.
3. Choose **Review backup** and check the connection, database and destination.
4. Choose **Start backup**. When the operation finishes, **Show in Folder** reveals a local backup.

The application includes the database clients. Installing PostgreSQL, MySQL or another database client separately is not a prerequisite. A custom executable path is an advanced override, not the normal setup flow.

## Restore a database

1. Open **Restore** and choose the saved connection and destination database.
2. Choose the backup file or directory. You can create a destination database from this window. SQLite and DuckDB restore into a new database file.
3. Review the destination, input and replacement options, then choose **Start restore**.

Restoration executes the contents of the chosen backup. Only restore files you trust. Restoring into a separate, empty destination makes verification easier. SQL scripts execute as programs with the permissions of the database account. The selected database is their initial connection, not an isolation boundary: `USE`, `\connect`, qualified names or file attachment commands can target other databases/files. The review screen identifies this execution scope. Review arbitrary SQL before running it; leaving a replacement checkbox unchecked does not rewrite its commands. Native archives use the engine-specific destination/remapping options.

## Formats and scope

| Engine | Backup and restore contract |
| --- | --- |
| PostgreSQL | Native `pg_dump` / `pg_restore` / `psql`. SQL and custom backups; restoration also recognizes directory and tar archives. Database objects supported by `pg_dump` are included; cluster roles and other databases are outside this scope. |
| MySQL / MariaDB | Native SQL dump with data, binary values, views, routines, triggers and events, subject to account permissions. Uses a single transaction where supported by the storage engine. |
| SQLite / DuckDB | Native SQL dump into a separate file. Restore targets a new database file. |
| MongoDB | Native BSON archive, including collection metadata and indexes. Enter the database name inside the backup when restoring to another database. |
| Redis | Zequel `.jsonl` archive containing native DUMP payloads, binary keys, TTLs and a checksum footer. Preserves stream groups and pending entries. Requires permission to SCAN, EVAL, DUMP, PTTL and RESTORE. |
| ClickHouse | Streaming SQL definitions and data. Views are restored after tables. References to the source database in captured definitions become relative to the selected destination. External dependencies and distributed cluster configuration are outside this database transfer. |
| SQL Server | Native `.bak` backup on the **database server**. Enter a server-accessible absolute path; it is not a file on your computer. New destinations receive new physical database file paths. |

ZIP is a container around a local backup, not a different database format. Zequel extracts ZIP files in a background worker and rejects ambiguous archives. SQL Server files stay on the server and are not zipped locally.

Older Zequel backups have separate compatibility readers where supported. A legacy backup that already omitted rows or object definitions cannot recover those missing objects.

## Progress, stopping and consistency

The window shows the current phase, elapsed time and the metrics available from the operation. A percentage appears only when the total is known. Native tools do not all report a reliable total, so some phases show activity and bytes or items instead.

**Cancel** requests cancellation and waits for process, connection and temporary-file cleanup. An operation is not reported complete merely because its window closed. SQL errors and native process failures are reported as failures. SQL restoration can leave changes applied before an error; PostgreSQL's single-transaction option can make supported restores atomic.

Backups do not impose a 10,000-row limit. Consistency still depends on the database: Redis SCAN and ClickHouse table-by-table exports are not global point-in-time snapshots, and MySQL nontransactional tables do not gain transactional consistency from a dump flag. Redis TTLs are stored as remaining durations and reapplied during restore.

Keep enough local space for the backup and temporary ZIP extraction. An existing local destination is preserved if publication cannot complete; choose a new filename rather than relying on silent replacement.
