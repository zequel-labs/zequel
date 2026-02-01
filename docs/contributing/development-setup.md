# Development Setup

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Docker** and **Docker Compose** (for local database instances)

## Setup

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
|------------|--------------------------------------|-------------------------|
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
