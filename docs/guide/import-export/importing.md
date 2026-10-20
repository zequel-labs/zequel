# Importing Data

Use **Import** on an existing table to load CSV or JSON records. This is a row transfer, separate from restoring a complete database backup.

1. Choose the file and inspect the bounded preview.
2. For CSV, select the delimiter and whether the first row contains headers. Quoted multiline fields and tab delimiters are supported.
3. Review the column mapping. Matching names are proposed automatically; leave unwanted columns unmapped. A destination column cannot be mapped twice.
4. Review the destination and choose whether to clear its existing rows.
5. Start the import and follow validation and insertion progress.

The preview reads a sample, not the entire file. When the total is unknown it is shown as unknown. Before writing, Zequel streams through the complete input to validate parsing and mapped types, then inserts bounded batches on a separate connection.

## Values

BIGINT and DECIMAL values retain their decimal text rather than passing through JavaScript floating point. Binary fields use `\x` followed by hexadecimal bytes. JSON values retain exact numeric text where available from the file or database export.

CSV uses unquoted `\N` for NULL by default. An empty field remains an empty string, and quoted `"\N"` remains literal text. You can change the NULL marker or leave it empty to disable marker conversion. Export's **NULL as empty string** option deliberately discards that distinction and is off by default.

Database types still impose their own constraints. Invalid values, duplicate keys and permission errors stop the import and are reported.

## Failure and cancellation

For PostgreSQL, SQLite, DuckDB, SQL Server and MySQL/MariaDB InnoDB tables, clearing and insertion use a transaction. A failed or cancelled operation rolls back before it reports its final result. For other storage engines, successful writes may remain; the result reports how many rows were applied.

Operations show row counts, bytes and elapsed time. You can cancel from the import dialog or the operation list in Backup/Restore. The dedicated connection allows the transfer to continue after its editor closes.

Clipboard pastes create pending changes in the grid. Review and commit them using the grid's normal editing flow.
