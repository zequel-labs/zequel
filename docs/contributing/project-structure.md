# Project Structure

Zequel is an Electron application with a Vue 3 renderer. The codebase is organized as follows:

```
src/
  main/               Electron main process
    db/                Database adapters (one per engine)
    ipc/               IPC handlers (connection, query, schema, export, ...)
    services/          Backend services (SSH tunnel, import, bookmarks, ...)
    types/             Main-process types
    utils/             Utilities (logger, etc.)
  preload/             Electron preload script (IPC bridge)
  renderer/            Vue 3 frontend
    components/        UI components (grid, editor, schema, dialogs, ...)
      ui/              Reka UI wrapped primitives
    views/             Page-level views
    stores/            Pinia state stores
    composables/       Vue composables
    lib/               Utilities (SQL snippets, formatter, ...)
    types/             Frontend types and enums
    directives/        Vue directives
  tests/
    unit/              Unit tests
    integration/       Integration tests
    e2e/               End-to-end tests
docker/                Init scripts and seed data per database
docs/                  Documentation (VitePress)
```

## Directory Details

### `src/main/`

The Electron main process. Runs in a Node.js environment with full system access.

- **`db/`** -- One adapter file per supported database engine (PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, Redis). Each adapter extends `BaseDriver` and implements the `DatabaseDriver` interface defined in `base.ts`. A `manager.ts` module manages active connections. See [Database Adapters](./database-adapters) for details.
- **`ipc/`** -- IPC handlers organized by domain. Each file registers handlers for a group of related operations. All handlers are wired together in `index.ts`. See [IPC Architecture](./ipc-architecture) for details.
- **`services/`** -- Higher-level backend services such as SSH tunneling, data import, bookmarks, and query history. These are used by the IPC handlers.
- **`types/`** -- TypeScript types and interfaces specific to the main process (connection config, query results, schema operation requests, etc.).
- **`utils/`** -- Shared utilities such as the structured logger.

### `src/preload/`

The Electron preload script. This is the only code that has access to both Node.js APIs and the renderer context. It exposes a typed `window.api` bridge using `contextBridge.exposeInMainWorld`.

### `src/renderer/`

The Vue 3 frontend, built with Vite.

- **`components/`** -- All Vue components. Filenames use PascalCase. The `ui/` subdirectory contains low-level primitives wrapping Reka UI (following the shadcn-vue pattern).
- **`views/`** -- Page-level components rendered by the router or the main layout.
- **`stores/`** -- Pinia stores using the composition API. Each store follows the `useXxxStore` naming convention.
- **`composables/`** -- Reusable composition functions following the `useXxx` naming convention.
- **`lib/`** -- Pure utility functions: SQL snippet helpers, data formatters, the `cn()` class-merging utility, and more.
- **`types/`** -- Frontend-specific TypeScript types and enums.
- **`directives/`** -- Custom Vue directives.

### `src/tests/`

All test files, organized to mirror the source tree.

- **`unit/`** -- Fast, isolated unit tests. Subdivided into `renderer/` and `main/` to match the source layout.
- **`integration/`** -- Tests that require running database containers started via Docker Compose.
- **`e2e/`** -- End-to-end tests that launch the full Electron application.

### `docker/`

Docker Compose configuration and initialization scripts. Each database has a subdirectory containing seed SQL or configuration files used to populate the development databases on first start.

### `docs/`

VitePress documentation source files. Run `npm run docs:dev` to preview locally.
