# Exporting Data

Zequel can export table data and query results to CSV, JSON, SQL, and Excel (XLSX) files. You can also copy exported data directly to the clipboard.

## Export to File

To export data to a file:

1. Open a table in the data grid or execute a query in a query tab.
2. Right-click the results panel and choose an export format: **CSV**, **JSON**, **SQL**, or **Excel**.
3. A native file save dialog appears with a suggested filename and extension.
4. Choose a location, adjust the filename if needed, and click **Save**.

Zequel writes the file and displays a success notification with the saved file path.

## Export to Clipboard

For CSV, JSON, and SQL formats, you can copy the exported content directly to the clipboard instead of saving to a file. Right-click the results panel and select the clipboard export option. The formatted data is placed on your clipboard, ready to paste into another application.

Excel (XLSX) export is not available for clipboard because the format is binary.

## Export Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| CSV | `.csv` | Comma-separated values with configurable delimiter. |
| JSON | `.json` | A JSON array of objects, one per row. |
| SQL | `.sql` | `INSERT INTO` statements for each row. |
| Excel | `.xlsx` | An Excel workbook with auto-sized columns. |

For detailed information on each format, see [Supported Formats](./formats).

## Export Options

### CSV

- **Include headers** -- When enabled (the default), column names are written as the first row.
- **Delimiter** -- Defaults to comma (`,`). You can use semicolons, tabs, or other characters.

### JSON

- Exported as a JSON array of objects. Each object uses column names as keys and cell values as values.
- `null` values are preserved. Object and array values are serialized as JSON strings.
- Output is pretty-printed with 2-space indentation.

### SQL

- Each row is written as a separate `INSERT INTO` statement.
- The table name defaults to the source table name. If the data comes from a query rather than a table, a placeholder name (`table_name`) is used.
- String values are escaped with single-quote doubling. `NULL` values are written as the SQL keyword `NULL`.

### Excel (XLSX)

- Data is written to a single worksheet. The sheet name matches the source table name (truncated to 31 characters, the Excel maximum).
- Column widths are automatically sized based on content, capped at 50 characters.
- Headers are included in the first row by default.

## Next Steps

- [Importing Data](./importing) -- Import data from CSV or JSON files into a table.
- [Supported Formats](./formats) -- Detailed reference for each import and export format.
- [Backup and Restore](./backup) -- Use SQL export for full database backups.
