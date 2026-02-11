# Introduction

Zequel is an open-source database management GUI built with Electron and Vue 3. It provides a fast, modern interface for working with relational and non-relational databases, all from a single desktop application.

Zequel is created by [Paulo Castellano](https://github.com/pcastellano) and licensed under the [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license).

## What Zequel Does

- **Connect** to multiple database engines through a unified interface.
- **Query** with a full-featured Monaco editor that supports syntax highlighting, autocompletion, 500+ built-in SQL functions, and multiple tabs.
- **Browse** table data in a virtual-scrolled grid with inline cell editing and foreign key navigation.
- **Visualize** schema relationships with auto-generated ER diagrams.
- **Import and export** data in CSV, JSON, SQL, and Excel formats.
- **Backup and restore** databases using native tools (pg_dump, mysqldump, etc.).
- **Monitor** active database processes and running queries.
- **Inspect** table properties, statistics, and DDL across all supported databases.
- **Pin** frequently-used tables and views to the sidebar for quick access.
- **Protect** your workflow with safe mode (blocks write operations) and privacy mode (blurs sensitive data).
- **Navigate** quickly with a command palette (Cmd+K / Ctrl+K) and keyboard shortcuts.

## Supported Databases

| Database    | Minimum Version |
| ----------- | --------------- |
| PostgreSQL  | 17+             |
| MySQL       | 8.4+            |
| MariaDB     | 11+             |
| SQLite      | 3+              |
| MongoDB     | 8+              |
| Redis       | 7+              |
| ClickHouse  | 24+             |

## Next Steps

- [Installation](/guide/installation) -- Download and install Zequel on your platform.
- [Quick Start](/guide/quick-start) -- Create your first connection and run a query in under two minutes.
- [Interface Overview](/guide/interface-overview) -- Learn the layout and navigation model.
