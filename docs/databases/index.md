# Database Support

Zequel supports nine databases, each with varying levels of feature support. Use the matrix below to compare capabilities across all supported databases.

## Feature Matrix

### Connection

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | DuckDB | MongoDB | Redis | ClickHouse | SQL Server |
|---------|:----------:|:-----:|:-------:|:------:|:------:|:-------:|:-----:|:----------:|:----------:|
| Standard Connection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SSH Tunnels | ✓ | ✓ | ✓ | -- | -- | ✓ | ✓ | ✓ | ✓ |
| SSL / TLS | ✓ | ✓ | ✓ | -- | -- | ✓ | -- | ✓ | ✓ |

### Schema

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | DuckDB | MongoDB | Redis | ClickHouse | SQL Server |
|---------|:----------:|:-----:|:-------:|:------:|:------:|:-------:|:-----:|:----------:|:----------:|
| Schemas | ✓ | -- | -- | -- | -- | -- | -- | -- | ✓ |
| Tables | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ | ✓ |
| Columns | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ | ✓ |
| Indexes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ |
| Foreign Keys | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | -- | ✓ |
| Views | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ | ✓ |
| Materialized Views | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| Routines | ✓ | ✓ | ✓ | -- | -- | -- | -- | -- | ✓ |
| Triggers | ✓ | ✓ | ✓ | -- | -- | -- | -- | -- | ✓ |
| Sequences | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| Enums | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| Events | -- | ✓ | ✓ | -- | -- | -- | -- | -- | -- |
| Extensions | ✓ | -- | -- | -- | -- | -- | -- | -- | -- |
| Collections | -- | -- | -- | -- | -- | ✓ | -- | -- | -- |
| Documents | -- | -- | -- | -- | -- | ✓ | -- | -- | -- |
| Key-Value Browsing | -- | -- | -- | -- | -- | -- | ✓ | -- | -- |

### Data

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | DuckDB | MongoDB | Redis | ClickHouse | SQL Server |
|---------|:----------:|:-----:|:-------:|:------:|:------:|:-------:|:-----:|:----------:|:----------:|
| Browse / Data Grid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Import | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Tools

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | DuckDB | MongoDB | Redis | ClickHouse | SQL Server |
|---------|:----------:|:-----:|:-------:|:------:|:------:|:-------:|:-----:|:----------:|:----------:|
| Query Editor | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ | ✓ |
| ER Diagrams | ✓ | ✓ | ✓ | -- | -- | -- | -- | -- | -- |
| Process Monitor | ✓ | ✓ | ✓ | -- | -- | -- | -- | ✓ | ✓ |
| Users | ✓ | ✓ | ✓ | -- | -- | -- | -- | -- | ✓ |
| Table Properties | ✓ | ✓ | -- | ✓ | ✓ | ✓ | -- | ✓ | ✓ |
| FK Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- | -- | ✓ |
| Backup / Restore | ✓ | ✓ | -- | ✓ | -- | ✓ | ✓ | -- | ✓ |

## Default Ports

| Database | Default Port |
|----------|:------------:|
| PostgreSQL | 5432 |
| MySQL | 3306 |
| MariaDB | 3306 |
| SQLite | N/A (local file) |
| DuckDB | N/A (local file) |
| MongoDB | 27017 |
| Redis | 6379 |
| ClickHouse | 8123 (HTTP) |
| SQL Server | 1433 |

## Supported Versions

| Database | Versions |
|----------|:--------:|
| PostgreSQL | 12 – Latest |
| MySQL | 5.7 – Latest |
| MariaDB | 10.4 – Latest |
| SQLite | 3+ (bundled) |
| DuckDB | 1.0+ (bundled) |
| MongoDB | 4.2 – Latest |
| Redis | 6.0 – Latest |
| ClickHouse | 22.8 – Latest |
| SQL Server | 2012 – Latest |
