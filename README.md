<p align="center">
  <img src="build/icons/png/128x128.png" alt="Zequel" />
</p>

<h1 align="center">Zequel</h1>

<p align="center">
  A modern, open-source database management GUI for macOS, Windows, and Linux.
</p>

<p align="center">
  <a href="https://github.com/zequelhq/zequel/releases"><img src="https://img.shields.io/github/v/release/zequelhq/zequel?include_prereleases&label=download" alt="Download" /></a>
  <a href="https://github.com/zequelhq/zequel/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Elastic%202.0-blue" alt="License" /></a>
  <a href="https://github.com/zequelhq/zequel/stargazers"><img src="https://img.shields.io/github/stars/zequelhq/zequel" alt="Stars" /></a>
  <a href="https://github.com/zequelhq/zequel/issues"><img src="https://img.shields.io/github/issues/zequelhq/zequel" alt="Issues" /></a>
  <a href="https://github.com/zequelhq/zequel/pulls"><img src="https://img.shields.io/github/issues-pr/zequelhq/zequel" alt="PRs" /></a>
</p>

---

## Supported Databases

<p align="center">
  <img src="src/renderer/assets/images/postgresql.svg" alt="PostgreSQL" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/mysql.svg" alt="MySQL" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/mariadb.svg" alt="MariaDB" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/sqlite.svg" alt="SQLite" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/mongodb.svg" alt="MongoDB" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/redis.svg" alt="Redis" width="48" height="48" />&nbsp;&nbsp;&nbsp;
  <img src="src/renderer/assets/images/clickhouse.svg" alt="ClickHouse" width="48" height="48" />
</p>

| Database | Version | SSH Tunnel |
|----------|---------|------------|
| PostgreSQL | 17+ | Yes |
| MySQL | 8.4+ | Yes |
| MariaDB | 11+ | Yes |
| SQLite | 3+ | - |
| MongoDB | 8+ | Yes |
| Redis | 7+ | Yes |
| ClickHouse | 24+ | Yes |

## Features

- **Query Editor** - Monaco-based editor with syntax highlighting, auto-complete, multiple tabs, parameterized queries, EXPLAIN visualization, and 30+ SQL snippets per dialect
- **Schema Browser** - Explore and manage databases, tables, columns, indexes, foreign keys, views, routines, triggers, sequences, enums, and extensions
- **Data Grid** - Virtual-scrolled grid with in-cell editing, filtering, sorting, column resize/reorder, multi-row selection, bulk operations, and undo/redo
- **ER Diagrams** - Interactive entity-relationship diagram visualization
- **Import / Export** - CSV, JSON, SQL, and Excel formats
- **Security** - SSL/TLS connections, SSH tunneling, OS-level credential storage
- **Process Monitor** - View and manage active database processes
- **Command Palette** - Quick access to all actions via `Cmd+K` / `Ctrl+K`
- **Dark / Light Theme** - Follows system preference or manual toggle
- **Cross-platform** - Native builds for macOS (Intel + Apple Silicon), Windows, and Linux

## Download

Get the latest release for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Zequel-arm64.dmg](https://github.com/zequelhq/zequel/releases/latest) |
| macOS (Intel) | [Zequel.dmg](https://github.com/zequelhq/zequel/releases/latest) |
| Windows | [Zequel-Setup.exe](https://github.com/zequelhq/zequel/releases/latest) |
| Linux | [Zequel.AppImage](https://github.com/zequelhq/zequel/releases/latest) |

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Docker** and **Docker Compose** (for local database instances)

### 1. Clone the repository

```bash
git clone https://github.com/zequelhq/zequel.git
cd zequel
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development databases

```bash
docker compose up -d
```

This starts all seven databases with seed data:

| Service | Host Port | Credentials |
|---------|-----------|-------------|
| PostgreSQL | 54320 | `zequel` / `zequel` |
| MySQL | 33060 | `zequel` / `zequel` |
| MariaDB | 33070 | `zequel` / `zequel` |
| MongoDB | 27018 | `zequel` / `zequel` |
| Redis | 63790 | password: `zequel` |
| ClickHouse | 18123 (HTTP), 19000 (Native) | `zequel` / `zequel` |

For SQLite, the database file is at `docker/sqlite/zequel.db`. Recreate it with:

```bash
sqlite3 docker/sqlite/zequel.db < docker/sqlite/init.sql
```

See [docs/connection-urls.md](docs/connection-urls.md) for ready-to-paste connection URLs.

### 4. Run the app

```bash
npm run dev
```

### 5. Run tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires Docker databases running)
npm run test:integration

# All tests in watch mode
npm test

# Coverage report
npm run test:coverage
```

### 6. Build for production

```bash
npm run build
```

The output will be in the `dist/` directory.

## Project Structure

```
src/
  main/             Electron main process
    db/              Database adapters (one per engine)
    ipc/             IPC handlers (connection, query, schema, export, ...)
    services/        Backend services (SSH tunnel, import, bookmarks, ...)
  preload/           Electron preload script (IPC bridge)
  renderer/          Vue 3 frontend
    components/      UI components (grid, editor, schema, dialogs, ...)
    views/           Page-level views
    stores/          Pinia state stores
    composables/     Vue composables
    lib/             Utilities (SQL snippets, formatter, ...)
  tests/
    unit/            Unit tests
    integration/     Integration tests (require running databases)
docker/              Init scripts and seed data per database
docs/                Additional documentation
```

## Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests — all help is appreciated.

### Opening a Pull Request

1. Fork the repository and create your branch from `main`:

```bash
git checkout -b my-feature
```

2. Make your changes. Follow the existing code style and conventions.

3. If you added or changed functionality, add or update tests.

4. Run the type checker and tests to make sure nothing is broken:

```bash
npm run typecheck
npm run test:unit
```

5. Commit your changes with a clear message describing what and why.

6. Push to your fork and open a Pull Request against `main`.

### Development Guidelines

- **TypeScript** is required for all code. Separate tsconfig files exist for the main process (`tsconfig.node.json`) and renderer (`tsconfig.web.json`).
- **Vue 3 Composition API** with `<script setup lang="ts">` for all components.
- **Tailwind CSS v4** for styling. UI primitives come from Reka UI (shadcn-vue pattern).
- Database adapters extend the `DatabaseDriver` interface in `src/main/db/base.ts`.
- IPC handlers go in `src/main/ipc/` and are exposed through `src/preload/index.ts`.

### Running Individual Database Services

If you only need specific databases, start them individually:

```bash
docker compose up -d postgres redis
```

## Author

Created by **Paulo Castellano**

- GitHub: [@paulocastellano](https://github.com/paulocastellano)
- X: [@paulocastellano](https://x.com/paulocastellano)

## License

[Elastic License 2.0](LICENSE)
