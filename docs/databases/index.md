# Database Support

Zequel supports seven databases, each with varying levels of feature support. Use the matrix below to compare capabilities across all supported databases.

## Feature Matrix

### Connection

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | MongoDB | Redis | ClickHouse |
|---------|:----------:|:-----:|:-------:|:------:|:-------:|:-----:|:----------:|
| Standard Connection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SSH Tunnels | ✓ | ✓ | ✓ | -- | ✓ | ✓ | ✓ |
| SSL / TLS | ✓ | ✓ | ✓ | -- | ✓ | -- | ✓ |

### Schema

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | MongoDB | Redis | ClickHouse |
|---------|:----------:|:-----:|:-------:|:------:|:-------:|:-----:|:----------:|
| Schemas | ✓ | -- | -- | -- | -- | -- | -- |
| Tables | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ |
| Columns | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ |
| Indexes | ✓ | ✓ | ✓ | ✓ | ✓ | -- | -- |
| Foreign Keys | ✓ | ✓ | ✓ | ✓ | -- | -- | -- |
| Views | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ |
| Materialized Views | ✓ | -- | -- | -- | -- | -- | -- |
| Routines | ✓ | ✓ | ✓ | -- | -- | -- | -- |
| Triggers | ✓ | ✓ | ✓ | -- | -- | -- | -- |
| Sequences | ✓ | -- | -- | -- | -- | -- | -- |
| Enums | ✓ | -- | -- | -- | -- | -- | -- |
| Events | -- | ✓ | ✓ | -- | -- | -- | -- |
| Extensions | ✓ | -- | -- | -- | -- | -- | -- |
| Collections | -- | -- | -- | -- | ✓ | -- | -- |
| Documents | -- | -- | -- | -- | ✓ | -- | -- |
| Key-Value Browsing | -- | -- | -- | -- | -- | ✓ | -- |

### Data

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | MongoDB | Redis | ClickHouse |
|---------|:----------:|:-----:|:-------:|:------:|:-------:|:-----:|:----------:|
| Browse / Data Grid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Import | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Tools

| Feature | PostgreSQL | MySQL | MariaDB | SQLite | MongoDB | Redis | ClickHouse |
|---------|:----------:|:-----:|:-------:|:------:|:-------:|:-----:|:----------:|
| Query Editor | ✓ | ✓ | ✓ | ✓ | -- | -- | ✓ |
| ER Diagrams | ✓ | ✓ | ✓ | -- | -- | -- | -- |
| Process Monitor | ✓ | ✓ | ✓ | -- | -- | -- | ✓ |
| Users | ✓ | ✓ | ✓ | -- | -- | -- | -- |

## Default Ports

| Database | Default Port |
|----------|:------------:|
| PostgreSQL | 5432 |
| MySQL | 3306 |
| MariaDB | 3306 |
| SQLite | N/A (local file) |
| MongoDB | 27017 |
| Redis | 6379 |
| ClickHouse | 8123 (HTTP) |

## Minimum Supported Versions

| Database | Minimum Version |
|----------|:---------------:|
| PostgreSQL | 17+ |
| MySQL | 8.4+ |
| MariaDB | 11+ |
| SQLite | 3+ |
| MongoDB | 8+ |
| Redis | 7+ |
| ClickHouse | 24+ |
