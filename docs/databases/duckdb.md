# DuckDB

Zequel supports DuckDB for working with local analytical database files. DuckDB is a serverless, file-based OLAP database engine optimized for analytical queries, so connections are made directly to a file on disk rather than over a network.

**Supported versions:** DuckDB 1.0+ (bundled engine -- no external server required)

## Connection Setup

To open a DuckDB database, provide the path to the database file on your local filesystem.

| Field | Description | Default |
|-------|-------------|---------|
| File Path | Absolute path to the `.duckdb` or `.db` file | -- |

DuckDB does not use a host, port, user, or password. Simply select or enter the path to your database file in the connection dialog.

### No SSH or SSL

Because DuckDB operates on local files, SSH tunnels and SSL/TLS connections are not applicable and are not available for DuckDB connections.

## Supported Features

### Tables and Columns

Create, browse, and manage tables and their columns. The data grid provides inline editing, sorting, and filtering.

### Indexes

View and manage indexes on your tables.

### Foreign Keys

Inspect foreign key relationships between tables. Note that DuckDB does not support adding or dropping foreign keys on existing tables -- they can only be defined at table creation time.

### Views

Create, edit, and manage standard SQL views.

### Transactions

DuckDB supports full transaction management with BEGIN, COMMIT, and ROLLBACK.

### Query Streaming

Stream large result sets efficiently using client-side pagination cursors.

## Limitations

The following features are **not available** for DuckDB:

- **SSH Tunnels** -- Not applicable for local file access.
- **SSL / TLS** -- Not applicable for local file access.
- **Schemas** -- DuckDB uses a single `main` schema.
- **Routines** -- DuckDB does not support stored procedures or functions.
- **Triggers** -- Not supported by DuckDB.
- **Users** -- DuckDB has no built-in user or role management.
- **ER Diagrams** -- Not available for DuckDB.
- **Process Monitor** -- Not applicable for a serverless database.
- **Events** -- Not supported by DuckDB.
- **Sequences** -- Not managed through Zequel for DuckDB.
- **Modify columns** -- DuckDB does not support altering column types directly. Tables must be recreated.
- **Add/Drop foreign keys** -- Foreign keys can only be defined at table creation time.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
