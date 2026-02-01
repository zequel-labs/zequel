# MySQL

Zequel provides full support for MySQL, including schema management, events, and administrative tools.

**Minimum supported version:** MySQL 8.4+

## Connection Setup

To connect to a MySQL database, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | Server port | `3306` |
| User | Database user | `root` |
| Password | User password | -- |
| Database | Target database name | -- |

### SSH Tunnels

You can connect to remote MySQL instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

Zequel supports SSL/TLS connections to MySQL. You can provide a CA certificate, client certificate, and client key to establish a secure connection.

## Supported Features

### Tables and Columns

Create, browse, and manage tables and their columns. The data grid provides inline editing, sorting, and filtering.

### Indexes

View and manage indexes on your tables.

### Foreign Keys

Inspect and manage foreign key relationships between tables.

### Views

Create and manage standard SQL views.

### Routines

Manage stored procedures and functions. View their definitions, parameters, and return types.

### Triggers

Browse and manage triggers attached to tables.

### Events

MySQL events (scheduled tasks) are fully supported. You can browse event definitions, schedules, and statuses. This is a feature shared with MariaDB but not available in other supported databases.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid.

### ER Diagrams

Generate entity-relationship diagrams from your database to visualize table structures and foreign key relationships.

### Process Monitor

View active connections and running queries. Useful for identifying long-running or blocked queries.

### Users

Browse database users and their privileges.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
