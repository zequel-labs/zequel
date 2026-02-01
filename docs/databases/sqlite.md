# SQLite

Zequel supports SQLite for working with local database files. SQLite is a serverless, file-based database engine, so connections are made directly to a file on disk rather than over a network.

**Minimum supported version:** SQLite 3+

## Connection Setup

To open a SQLite database, provide the path to the database file on your local filesystem.

| Field | Description | Default |
|-------|-------------|---------|
| File Path | Absolute path to the `.db` or `.sqlite` file | -- |

SQLite does not use a host, port, user, or password. Simply select or enter the path to your database file in the connection dialog.

### No SSH or SSL

Because SQLite operates on local files, SSH tunnels and SSL/TLS connections are not applicable and are not available for SQLite connections.

## Supported Features

### Tables and Columns

Create, browse, and manage tables and their columns. The data grid provides inline editing, sorting, and filtering.

### Indexes

View and manage indexes on your tables.

### Foreign Keys

Inspect foreign key relationships between tables. Note that foreign key enforcement must be enabled per-connection in SQLite (`PRAGMA foreign_keys = ON`).

### Views

Create and manage standard SQL views.

## Limitations

The following features are **not available** for SQLite:

- **SSH Tunnels** -- Not applicable for local file access.
- **SSL / TLS** -- Not applicable for local file access.
- **Routines** -- SQLite does not support stored procedures or functions.
- **Triggers** -- Not managed through Zequel for SQLite.
- **Users** -- SQLite has no built-in user or role management.
- **ER Diagrams** -- Not available for SQLite.
- **Process Monitor** -- Not applicable for a serverless database.
- **Events** -- Not supported by SQLite.
- **Schemas** -- SQLite uses a single flat namespace.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
