# PostgreSQL

Zequel provides comprehensive support for PostgreSQL, including full schema management, advanced object types, and administrative tools.

**Minimum supported version:** PostgreSQL 17+

## Connection Setup

To connect to a PostgreSQL database, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | Server port | `5432` |
| User | Database user | `postgres` |
| Password | User password | -- |
| Database | Target database name | `postgres` |

### SSH Tunnels

You can connect to remote PostgreSQL instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

Zequel supports SSL/TLS connections to PostgreSQL. You can provide a CA certificate, client certificate, and client key to establish a secure connection.

## Supported Features

### Schema Management

PostgreSQL is the only database in Zequel with full schema (namespace) support. You can browse and switch between schemas within a single database.

### Tables and Columns

Create, browse, and manage tables and their columns. The data grid provides inline editing, sorting, and filtering.

### Indexes

View and manage indexes on your tables, including unique indexes, partial indexes, and expression indexes.

### Foreign Keys

Inspect and manage foreign key relationships between tables.

### Views

Create and manage standard SQL views.

### Materialized Views

PostgreSQL materialized views are fully supported. You can browse their data, inspect their definitions, and refresh them.

### Routines

Manage stored functions and procedures. View their definitions, parameters, and return types.

### Triggers

Browse and manage triggers attached to tables.

### Sequences

View and manage sequences, including their current values, increments, and bounds.

### Enums

Browse custom enum types defined in your database.

### Extensions

View installed PostgreSQL extensions.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid.

### ER Diagrams

Generate entity-relationship diagrams from your schema to visualize table structures and foreign key relationships.

### Process Monitor

View active connections and running queries. Useful for identifying long-running or blocked queries.

### Users

Browse database roles and their privileges.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
