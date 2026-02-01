# Backup and Restore

Zequel provides a built-in backup and restore feature for exporting an entire database to a file and importing it back. The format depends on the database type: SQL databases produce `.sql` files, while Redis and MongoDB produce `.json` files.

## Exporting a Backup

To export a database backup:

1. Connect to the database you want to back up.
2. Open the backup export through the application menu or command palette.
3. A native file save dialog appears with a suggested filename that includes the current date (e.g., `backup_2025-06-15.sql`).
4. Choose a save location and click **Save**.

Zequel iterates through all tables in the database and generates the backup file.

### SQL Database Backups

For PostgreSQL, MySQL, MariaDB, SQLite, and ClickHouse connections, the backup file is a `.sql` script containing:

- A header comment with the generation timestamp.
- For each table:
  - A `DROP TABLE IF EXISTS` statement.
  - The full `CREATE TABLE` DDL (obtained from the database's own DDL generation).
  - `INSERT INTO` statements for all rows (up to 10,000 rows per table).

Example structure:

```sql
-- Database Backup
-- Generated: 2025-06-15T10:30:00.000Z

-- Table: users
DROP TABLE IF EXISTS "users";
CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "name" varchar(255),
  "email" varchar(255)
);

-- Data for users
INSERT INTO "users" ("id", "name", "email") VALUES (1, 'Alice', 'alice@example.com');
INSERT INTO "users" ("id", "name", "email") VALUES (2, 'Bob', 'bob@example.com');
```

### Redis Backups

For Redis connections, the backup is a JSON file containing all keys with their types, values, and TTL information. Supported key types include string, list, set, hash, sorted set (zset), and stream.

### MongoDB Backups

For MongoDB connections, the backup is a JSON file containing all collections and their documents. System collections and views are skipped. Documents are serialized using an extended JSON format that preserves types like ObjectId, Date, and Decimal128.

## Importing a Backup

To restore a database from a backup file:

1. Connect to the target database.
2. Open the backup import through the application menu or command palette.
3. A native file dialog opens. Select the backup file (`.sql` for SQL databases, `.json` for Redis or MongoDB).
4. Zequel reads the file and executes the statements or inserts the data.

### SQL Restore

For SQL databases, Zequel splits the file on semicolons and executes each statement individually. Comments (lines starting with `--`) are skipped. The restore summary reports:

- **Statements executed** -- The number of SQL statements that completed successfully.
- **Errors** -- Any statements that failed, along with the error message and a truncated preview of the failing statement.

### Redis Restore

For Redis imports, Zequel reads the JSON backup and restores each key according to its type. TTL values are reapplied if they were positive at the time of export.

### MongoDB Restore

For MongoDB imports, Zequel reads the JSON backup and inserts documents into each collection in batches of 1,000. Extended JSON markers (`$oid`, `$date`, `$numberLong`, etc.) are deserialized back to their native types.

## Best Practices

- **Schedule regular backups.** Use Zequel's backup export before making schema changes, running migrations, or performing bulk data modifications.
- **Verify backups.** After exporting, open the backup file in a text editor to confirm it contains the expected tables and data.
- **Restore to a test database first.** Before restoring to production, import the backup into a staging or test database to verify it completes without errors.
- **Be aware of row limits.** SQL backups export up to 10,000 rows per table. For tables larger than this, use your database engine's native dump tools (e.g., `pg_dump`, `mysqldump`) for a complete backup.
- **Backup files do not include views, functions, or triggers.** SQL backups contain only table schemas and data. Use the query editor to script other database objects separately.
- **Use source control for schema.** For production databases, maintain schema definitions in version-controlled migration files rather than relying solely on GUI backups.

## Limitations

- SQL backups are limited to 10,000 rows per table.
- SQL backups include only tables, not views, functions, triggers, sequences, or other schema objects.
- The SQL restore process executes statements sequentially. A failing statement does not stop subsequent statements, but errors are reported in the summary.
- Redis and MongoDB backups read all keys or documents into memory. Extremely large datasets may cause performance issues.
- MongoDB document import uses `insertMany` with `ordered: false`, so some documents in a batch may succeed even if others fail (for example, due to duplicate key errors).

## Next Steps

- [Exporting Data](./) -- Export individual table data or query results.
- [Importing Data](./importing) -- Import data from CSV or JSON files into a specific table.
- [Supported Formats](./formats) -- Detailed reference for CSV, JSON, SQL, and Excel formats.
