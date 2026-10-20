# Exporting Data

Zequel exports rows as CSV, JSON or SQL INSERT statements. Choose the scope before exporting:

- **Selected rows / loaded results:** exports the rows currently supplied by the grid or query result. It does not fetch rows outside that loaded result.
- **Entire table:** streams the table using a dedicated connection and bounded batches. Grid pagination and filters do not restrict this export.

The export dialog shows the scope and destination, with options specific to the selected format. Choose a file and start the operation. Progress shows rows, bytes and elapsed time; the operation list in Backup/Restore retains its result even if the original editor closes.

CSV supports headers, delimiter selection and an explicit NULL-to-empty conversion. JSON supports pretty printing. SQL uses the source database dialect and can include schema qualification or table DDL where available. See [Supported Formats](./formats) for value-preservation details.

Copy actions place the selected loaded data on the clipboard; they do not perform a streaming export of the whole table.

To transfer a complete database and its supported objects, use [Backup and Restore](./backup). To insert records into an existing table, see [Importing Data](./importing).
