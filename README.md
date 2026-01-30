# Zequel

A modern database management GUI for macOS, built with Electron and Vue 3.

## Supported Databases

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
- **Security** - SSL/TLS connections, SSH tunneling, macOS Keychain credential storage
- **Process Monitor** - View and manage active database processes
- **Command Palette** - Quick access to all actions via `Cmd+K`
- **Dark / Light Theme** - Follows system preference or manual toggle

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Docker** and **Docker Compose** (for local database instances)

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/nicepkg/zequel.git
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
npm run build:mac
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
npm run test:run
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

## License

[Elastic License 2.0](LICENSE)
