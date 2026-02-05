# IPC Architecture

Zequel uses Electron's IPC (inter-process communication) system to let the Vue 3 renderer communicate with the Node.js main process. All database operations, file system access, and system-level actions flow through this channel.

## Overview

```
Renderer (Vue 3)
    |
    |  window.api.schema.tables(connectionId, db)
    v
Preload script (src/preload/index.ts)
    |
    |  ipcRenderer.invoke('schema:tables', connectionId, db)
    v
Main process IPC handler (src/main/ipc/schema.ts)
    |
    |  driver.getTables(db)
    v
Database adapter (src/main/db/postgres.ts)
```

## Preload Script

The preload script at `src/preload/index.ts` is the bridge between the renderer and the main process. It uses `contextBridge.exposeInMainWorld` to expose a typed `window.api` object. This object is organized into namespaces that mirror the IPC handler domains:

```typescript
window.api.connections   // connection CRUD, test, connect/disconnect
window.api.query         // execute, executeMultiple, cancel
window.api.schema        // introspection, schema editing, views, routines, triggers
window.api.history       // query history
window.api.savedQueries  // saved query management
window.api.app           // version, dialogs, file I/O
window.api.export        // export to file or clipboard
window.api.import        // CSV/JSON import
window.api.monitoring    // process list, kill, server status
window.api.bookmarks     // bookmark CRUD
window.api.recents       // recent items
window.api.theme         // theme switching
window.api.updater       // check, download, install updates
```

The preload script also handles Vue proxy serialization: a `toPlain` helper converts reactive objects to plain JSON before sending them over IPC.

## IPC Handlers

All IPC handlers live in `src/main/ipc/` and are organized by domain:

| File | Domain | Examples |
|-------------------|----------------------|----------------------------------------------|
| `connection.ts` | Connections | list, save, delete, test, connect, disconnect |
| `query.ts` | Query execution | execute, executeMultiple, cancel |
| `schema.ts` | Schema introspection | databases, tables, columns, indexes, foreign keys, DDL |
| `schema-edit.ts` | Schema modification | addColumn, modifyColumn, createTable, dropTable |
| `history.ts` | Query history | list, add, clear, delete |
| `export.ts` | Data export | toFile, toClipboard |
| `import.ts` | Data import | preview, reparse, execute |
| `monitoring.ts` | Server monitoring | getProcessList, killProcess, getServerStatus |
| `postgresql.ts` | PostgreSQL-specific | sequences, materialized views, extensions, enums |
| `bookmarks.ts` | Bookmarks | add, list, update, remove |
| `recents.ts` | Recent items | add, list, remove, clear |
| `app.ts` | Application | getVersion, openExternal, showOpenDialog |
| `updater.ts` | Auto-update | check, download, install |
| `helpers.ts` | Shared utilities | Helper functions used across handlers |

### Registration

All handler groups are registered in `src/main/ipc/index.ts`:

```typescript
export const registerAllHandlers = (): void => {
  registerAppHandlers();
  registerConnectionHandlers();
  registerQueryHandlers();
  registerSchemaHandlers();
  registerSchemaEditHandlers();
  registerHistoryHandlers();
  registerExportHandlers();
  registerImportHandlers();
  registerMonitoringHandlers();
  registerPostgreSQLHandlers();
  registerRecentsHandlers();
  registerBookmarkHandlers();
  registerUpdaterHandlers();
};
```

This function is called once during application startup.

## Event-Based Communication

In addition to the request/response pattern (`ipcRenderer.invoke` / `ipcMain.handle`), Zequel uses event-based communication for push notifications from the main process to the renderer:

| Channel | Purpose |
|-----------------------|----------------------------------------|
| `theme:changed` | Notifies renderer when the OS theme changes |
| `query:log` | Streams executed SQL to the query log panel |
| `connection:status` | Reports reconnection attempts and errors |
| `updater:status` | Reports update check, download progress, and readiness |

The renderer subscribes to these events through `window.api` methods such as `window.api.theme.onChange(callback)` and cleans up listeners on unmount.

## Adding a New IPC Handler

1. **Create or extend a handler file** in `src/main/ipc/`. Use `ipcMain.handle` for request/response channels.
2. **Register the handler** by calling it from `registerAllHandlers` in `src/main/ipc/index.ts`.
3. **Expose the channel** in `src/preload/index.ts` by adding a method to the appropriate namespace on the `api` object.
4. **Add the TypeScript type** for the preload API in `src/preload/index.d.ts`.
5. **Call the API** from the renderer via `window.api.<namespace>.<method>(...)`.
