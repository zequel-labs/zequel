# Supported Formats

Zequel supports four file formats for data export and two for data import. This page describes each format in detail, including its options and limitations.

## Format Support Matrix

| Format | Export | Import | Clipboard |
|--------|--------|--------|-----------|
| CSV | Yes | Yes | Yes |
| JSON | Yes | Yes | Yes |
| SQL | Yes | No (see [Backup and Restore](./backup)) | Yes |
| Excel (XLSX) | Yes | No | No |

## CSV

**Extension:** `.csv`, `.tsv`, `.txt`

CSV (Comma-Separated Values) is a plain-text format where each line represents a row and values are separated by a delimiter character.

### Export Behavior

- **Delimiter** -- Defaults to comma (`,`). Configurable to semicolon, tab, pipe, or any single character.
- **Headers** -- Column names are written as the first row by default. This can be disabled.
- **Quoting** -- Fields that contain the delimiter, double quotes, or newline characters are wrapped in double quotes. Internal double quotes are escaped by doubling them (`""`).
- **Null values** -- `NULL` database values are exported as empty strings.
- **Object values** -- Values of type object or array are serialized as JSON strings.

### Import Behavior

- Zequel uses the `csv-parse` library to read CSV files.
- The first row is treated as headers by default. Toggle this off if your file has no header row.
- Custom delimiters can be specified in the parse options.
- Detected column types (INTEGER, TEXT, BOOLEAN, etc.) are inferred from sample values and used during column mapping.

### Limitations

- No support for multi-character delimiters.
- Encoding is assumed to be UTF-8.

## JSON

**Extension:** `.json`

JSON (JavaScript Object Notation) is a structured text format widely used for data interchange.

### Export Behavior

- Data is exported as a JSON array of objects.
- Each object represents one row, with column names as keys.

```json
[
  {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  },
  {
    "id": 2,
    "name": "Bob",
    "email": "bob@example.com"
  }
]
```

- `null` and `undefined` values are preserved as JSON `null`.
- Object and array column values are serialized inline.
- Output is pretty-printed with 2-space indentation for readability.

### Import Behavior

- Zequel expects the file to contain a JSON array of objects at the top level.
- Keys from the first object are used as column names.
- Type detection analyzes sample values across all objects.

### Limitations

- The entire file is read into memory. Very large JSON files (hundreds of megabytes) may cause performance issues.
- Nested objects are not flattened automatically. They are stored as JSON strings unless the target column type is JSON or JSONB.

## SQL

**Extension:** `.sql`

SQL export generates `INSERT INTO` statements that can be executed against any compatible SQL database.

### Export Behavior

- Each row produces one `INSERT INTO` statement.
- Column names are double-quoted in the column list.
- String values use single quotes with internal single quotes escaped by doubling (`''`).
- `NULL` values are written as the SQL keyword `NULL`.
- Numeric values are written without quotes.
- Boolean values are converted to `1` or `0`.

Example output:

```sql
INSERT INTO "users" ("id", "name", "email") VALUES (1, 'Alice', 'alice@example.com');
INSERT INTO "users" ("id", "name", "email") VALUES (2, 'Bob', 'bob@example.com');
```

### Limitations

- SQL export does not include `CREATE TABLE` statements. Use [Backup and Restore](./backup) for full schema and data exports.
- The generated SQL uses double-quoted identifiers, which are standard SQL but may require adjustment for some database engines.
- No batch `INSERT` syntax (e.g., multi-row `VALUES` clauses) is generated. Each row is a separate statement.

## Excel (XLSX)

**Extension:** `.xlsx`

Excel export creates an XLSX workbook compatible with Microsoft Excel, Google Sheets, LibreOffice Calc, and other spreadsheet applications.

### Export Behavior

- Data is written to a single worksheet within the workbook.
- The worksheet name matches the source table name, truncated to 31 characters (the Excel sheet name limit).
- If the data comes from a query rather than a named table, the sheet is named "Data".
- Column headers are included in the first row by default.
- Column widths are auto-sized based on content length, capped at 50 characters wide.
- `NULL` values are written as empty cells.
- Object and array values are serialized as JSON strings.

### Limitations

- Excel export is available only when saving to a file. It cannot be copied to the clipboard.
- Import from Excel files is not supported.
- Formatting (bold headers, cell colors, number formats) is not applied. All data is written as plain values.
- The XLSX format has a maximum of 1,048,576 rows per worksheet. Exports exceeding this limit will be truncated.

## Next Steps

- [Exporting Data](./) -- Export table data or query results.
- [Importing Data](./importing) -- Import data from CSV or JSON files.
- [Backup and Restore](./backup) -- Full database backup and restore workflows.
