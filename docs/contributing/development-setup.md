# Development Setup

## Prerequisites

- **Node.js** 26 (use `nvm install 26 && nvm use 26`)
- **npm** >= 10
- **Docker** and **Docker Compose** (for local database instances)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/zequel-labs/zequel.git
cd zequel
```

### 2. Install dependencies

```bash
nvm install 26
nvm use 26
npm ci
```

Development and CI use Node 26. An optional `.nvmrc` is local and ignored by Git. The application uses the
Node runtime bundled with Electron. Installation rebuilds native dependencies
for Electron; changing the host Node version alone does not change that runtime.
The `allowScripts` entries in `package.json` authorize installation scripts for
the locked versions of Electron and native/build dependencies. Review those
entries when updating these dependencies.

The `extract-zip` override pins `yauzl` to 3.4.0 because the older ZIP reader can
silently leave Electron partially extracted on Node 26
([upstream issue](https://github.com/electron/electron/issues/51619)).
Remove the override when the installer dependency includes the fix.

### 3. Start the development databases

```bash
docker compose up -d
```

This starts seven database containers with seed data:

| Service | Host Port | Credentials |
|------------|--------------------------------------|-------------------------|
| PostgreSQL | 54320 | `zequel` / `zequel` |
| MySQL | 33061 | `zequel` / `zequel` |
| MariaDB | 33070 | `zequel` / `zequel` |
| SQL Server | 14330 | `sa` / `Zequel123!` |
| MongoDB | 27018 | `zequel` / `zequel` |
| Redis | 63790 | password: `zequel` |
| ClickHouse | 18123 (HTTP), 19000 (Native) | `zequel` / `zequel` |

SQLite and DuckDB are file-based databases and don't need Docker containers. The SQLite database file is at `docker/sqlite/zequel.db`. Recreate it with:

```bash
sqlite3 docker/sqlite/zequel.db < docker/sqlite/init.sql
```

See [Connection URLs](./connection-urls) for ready-to-paste connection strings.

If you only need specific databases, start them individually:

```bash
docker compose up -d postgres redis
```

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

The output will be in the `dist/` directory. See [Releasing](./releasing) for full release instructions.
