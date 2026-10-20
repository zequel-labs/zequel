# Supported Formats

| Format | Row export | Row import | Clipboard |
| --- | --- | --- | --- |
| CSV | Yes | Yes | Yes |
| JSON | Yes | Yes | Yes |
| SQL INSERT statements | Yes | Use the SQL editor or the appropriate restore flow | Yes |

Excel/XLSX is not offered by the current row transfer interface. Database backup formats are described separately in [Backup and Restore](./backup).

## CSV

CSV export supports headers and a configurable delimiter. Fields containing delimiters, quotes or newlines are quoted, and embedded quotes are doubled. Import accepts quoted multiline fields, UTF-8, an optional byte-order mark and files without headers.

By default, unquoted `\N` represents NULL. An empty field represents an empty string; `"\N"` represents literal text. The import NULL marker is configurable. Export's **NULL as empty string** option is an explicit, lossy conversion.

Binary columns use `\x` plus hexadecimal bytes. Exact numeric values remain decimal text. A CSV file does not carry a database schema, indexes or constraints.

## JSON

Export produces an array of row objects with optional pretty printing. NULL remains JSON `null`; binary values use the same hexadecimal convention as CSV. Exact BIGINT/DECIMAL values may be strings to preserve precision. PostgreSQL full-table exports preserve server text for JSON, arrays and temporal or extension types when JavaScript decoding would lose information.

Import reads JSON incrementally. It supports an array of objects, one object, or a wrapper object's first array. Nested input objects are flattened into named fields for mapping; JSON text exported as a column can be mapped back to JSON/JSONB. Numbers are parsed without first converting them to JavaScript floating point.

The preview is bounded; the full import does not load the file into memory. Non-finite numbers that JSON cannot represent are reported as an error instead of silently becoming NULL.

## SQL

Row export generates INSERT statements using the source engine's identifier quoting, boolean and binary literal conventions. Schema qualification and table DDL are optional where available. Text is escaped and NULL is emitted as a SQL keyword. Exact numeric strings may be quoted and converted by the destination column type.

SQL row exports are intended for the source dialect. They are not a database backup and do not include every dependent object. Inspect the destination table name for query-result exports, which may use a placeholder when there is no source table.
