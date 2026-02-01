# Importing Data

Zequel can import data from CSV and JSON files into an existing database table. The import workflow includes a file preview, column mapping, and type conversion.

## Starting an Import

To begin importing data:

1. Right-click a table name in the sidebar.
2. Select **"Import Data"**.
3. Choose the file format: **CSV** or **JSON**.
4. A native file dialog opens. Select the file you want to import.

After selecting a file, Zequel parses it and displays a preview of the data.

## Import Preview

The import preview shows:

- **Detected columns** -- Column names inferred from the file (CSV headers or JSON keys).
- **Sample values** -- A few sample values from each column to help verify the data looks correct.
- **Detected types** -- Zequel analyzes sample values to suggest a data type for each column (e.g., INTEGER, TEXT, BOOLEAN).
- **Total rows** -- The total number of rows detected in the file.

The preview displays up to 100 rows. The full file is imported when you execute the import.

## Adjusting Parse Options

If the preview does not look right, you can adjust parse options and re-parse the file:

- **Has headers** -- Toggle whether the first row of a CSV file is treated as column headers. When disabled, columns are named generically (e.g., `column_1`, `column_2`).
- **Delimiter** -- For CSV files, change the delimiter character (comma, semicolon, tab, or a custom character).

The preview updates automatically after changing these options.

## Column Mapping

Before executing the import, map each source column from the file to a target column in the database table:

| Setting | Description |
|---------|-------------|
| **Source Column** | The column name from the imported file. |
| **Target Column** | The column in the database table where the data will be inserted. |
| **Target Type** | The database column type, used for automatic type conversion during import. |

Zequel fetches the target table's column definitions to populate the mapping dropdowns. Columns that do not have a mapping are skipped during import.

### Type Conversion

Values are automatically converted based on the target column type:

- **INTEGER, BIGINT, SMALLINT** -- Parsed as integers. Non-numeric values become `NULL`.
- **DECIMAL, FLOAT, DOUBLE, REAL, NUMERIC** -- Parsed as floating-point numbers.
- **BOOLEAN** -- Recognizes `true`, `1`, and `yes` as true; everything else is false.
- **JSON, JSONB** -- String values are parsed as JSON if valid.
- **TEXT, VARCHAR, and other string types** -- Values are kept as strings.

## Executing the Import

After configuring column mappings, click **"Import"** to start the import. Zequel inserts rows one at a time, in batches. During the import:

- A progress indicator shows how many rows have been processed.
- If **Truncate table** is enabled, all existing rows in the target table are deleted before inserting new data.
- Errors on individual rows are collected and reported at the end without stopping the entire import.

When the import completes, a summary shows the number of successfully inserted rows and any errors encountered.

## Limitations

- Import supports **CSV** and **JSON** formats. SQL and Excel file import is not supported through the Import Dialog. To import from a SQL file, use the [Backup and Restore](./backup) feature.
- Rows are inserted individually, which may be slow for very large files. For bulk loading, consider using your database's native import tools.
- Error messages are capped at 100 entries in the summary to avoid overwhelming the interface.

## Next Steps

- [Exporting Data](./) -- Export table data or query results to a file.
- [Supported Formats](./formats) -- Learn about the details of each file format.
- [Backup and Restore](./backup) -- Import full database backups from SQL files.
