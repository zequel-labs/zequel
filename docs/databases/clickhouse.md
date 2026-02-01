# ClickHouse

Zequel supports ClickHouse, a column-oriented database designed for online analytical processing (OLAP). ClickHouse is optimized for fast reads over large datasets.

**Minimum supported version:** ClickHouse 24+

## Connection Setup

To connect to a ClickHouse instance, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | HTTP interface port | `8123` |
| User | Database user | `default` |
| Password | User password | -- |
| Database | Target database name | `default` |

### Connection Protocols

ClickHouse exposes two interfaces:

| Protocol | Default Port | Description |
|----------|:------------:|-------------|
| HTTP | 8123 | Used by Zequel for connections. Widely compatible and firewall-friendly. |
| Native | 9000 | ClickHouse native binary protocol. Used by the ClickHouse CLI and some drivers. |

Zequel connects to ClickHouse over the HTTP interface on port 8123 by default.

### SSH Tunnels

You can connect to remote ClickHouse instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

Zequel supports SSL/TLS connections to ClickHouse. You can provide a CA certificate, client certificate, and client key to establish a secure connection. When using SSL, the default HTTP port is typically `8443`.

## Supported Features

### Tables and Columns

Browse and inspect tables and their columns. ClickHouse uses a variety of table engines (MergeTree, ReplacingMergeTree, etc.) that determine how data is stored and queried. The data grid provides browsing, sorting, and filtering.

### Views

View and inspect standard ClickHouse views.

### Process Monitor

View active queries and their resource usage. Useful for identifying slow or resource-intensive queries in an analytical workload.

## ClickHouse-Specific Notes

- **Table Engines** -- ClickHouse tables are backed by different engines (MergeTree family, Log family, etc.). The engine determines storage behavior, indexing, and replication. Zequel displays the engine type for each table.
- **Approximate Counts** -- Row counts in ClickHouse may be approximate depending on the table engine, as exact counts can be expensive on large datasets.
- **No Foreign Keys** -- ClickHouse does not support foreign key constraints. Data integrity is managed at the application level.
- **No Traditional Indexes** -- ClickHouse uses primary keys and data skipping indexes rather than B-tree indexes found in relational databases.

## Limitations

The following features are **not available** for ClickHouse:

- **Foreign Keys** -- Not supported by ClickHouse.
- **Traditional Indexes** -- ClickHouse uses its own indexing mechanisms.
- **Routines / Triggers** -- Not supported by ClickHouse.
- **Events** -- Not supported by ClickHouse.
- **ER Diagrams** -- Not available due to the lack of foreign key relationships.
- **Users** -- Not managed through Zequel for ClickHouse.

## Tools

### Query Editor

Write and execute SQL queries with syntax highlighting, autocompletion, and result display in the data grid. ClickHouse supports standard SQL with extensions for analytical functions.

### Process Monitor

Monitor running queries and their resource consumption.

## Data Operations

- **Browse** -- View table data in a paginated data grid.
- **Edit** -- Modify cell values directly in the data grid.
- **Import** -- Load data into tables from external files.
- **Export** -- Export query results or table data to various formats.
