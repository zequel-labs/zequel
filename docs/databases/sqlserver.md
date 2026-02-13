# SQL Server

Zequel provides comprehensive support for Microsoft SQL Server, including schema-aware browsing, routines, triggers, and administrative tools.

**Supported versions:** SQL Server 2012 – Latest

## Connection Setup

To connect to a SQL Server database, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | Server port | `1433` |
| User | Database user | `sa` |
| Password | User password | -- |
| Database | Target database name | `master` |

SQL Server also supports named instances. To connect to a named instance, use the format `hostname\instancename` in the Host field.

### SSH Tunnels

You can connect to remote SQL Server instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

Zequel supports SSL/TLS connections to SQL Server. You can provide a CA certificate, client certificate, and client key to establish a secure connection.

## Supported Features

### Schema Management

SQL Server has full schema (namespace) support, similar to PostgreSQL. You can browse and switch between schemas within a single database. The default schema is `dbo`.

### Tables and Columns

Create, browse, and manage tables and their columns. The data grid provides inline editing, sorting, and filtering. Identity columns (auto-increment) are fully supported.

### Indexes

View and manage indexes on your tables, including unique indexes.

### Foreign Keys

Inspect and manage foreign key relationships between tables, including ON UPDATE and ON DELETE rules.

### Views

Create and manage standard SQL views.

### Routines

Manage stored procedures and functions. View their definitions, parameters, and return types.

### Triggers

Browse and manage triggers attached to tables. SQL Server supports INSTEAD OF and AFTER triggers on INSERT, UPDATE, and DELETE events.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid.

### Process Monitor

View active connections and running sessions. Useful for identifying long-running or blocked queries. You can terminate sessions directly from the monitor.

### Users

Browse and manage SQL Server logins and database users.

### Backup / Restore

Backup and restore databases using the `sqlcmd` tool. The tool must be available in your system PATH or configured manually in settings. On macOS, it is typically located at `/opt/mssql-tools18/bin/sqlcmd`.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
