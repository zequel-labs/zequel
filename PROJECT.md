# DB Studio - Database Management Client

## Overview

A modern, fast, and intuitive database management GUI for macOS. Inspired by TablePlus and Beekeeper Studio, built with Electron, Vue 3, and Tailwind CSS.

**Target Users:** Developers, DBAs, and technical professionals who need a reliable tool to manage multiple database connections.

---

## Tech Stack

### Core
- **Electron** (latest stable) - Desktop runtime
- **electron-vite** - Build tooling with HMR support
- **Vue 3** - Composition API + `<script setup>`
- **TypeScript** - Full type safety
- **Tailwind CSS 3** - Utility-first styling
- **shadcn-vue** - UI component library

### Database Drivers
- **better-sqlite3** - SQLite (native, fast)
- **mysql2** - MySQL / MariaDB
- **pg** - PostgreSQL
- **knex.js** - Query builder abstraction layer

### UI Components
- **Monaco Editor** - SQL editor with syntax highlighting, autocomplete
- **TanStack Table** - Virtualized data grid (handle millions of rows)
- **splitpanes** - Resizable panes layout
- **@vueuse/core** - Vue composition utilities

### State Management
- **Pinia** - Global state (connections, tabs, settings)

### Storage
- **electron-store** - Encrypted local storage for connection credentials
- **keytar** - OS keychain integration for sensitive data

### Build & Distribution
- **electron-builder** - Package and distribute
- **electron-updater** - Auto-updates

---

## Features

### Phase 1 - MVP

#### Connection Management
- [ ] Create, edit, delete database connections
- [ ] Support for MySQL, PostgreSQL, SQLite
- [ ] Secure credential storage (OS keychain)
- [ ] Connection testing before save
- [ ] Connection grouping/folders
- [ ] Import/export connections (encrypted JSON)

#### Database Explorer (Sidebar)
- [ ] Tree view: Connection → Database → Schema → Tables/Views
- [ ] Icons per object type
- [ ] Quick filter/search in tree
- [ ] Refresh individual nodes
- [ ] Right-click context menu (copy name, drop, truncate, etc.)

#### Tab System
- [ ] Multiple tabs per connection
- [ ] Tab types: Query, Table Data, Table Structure
- [ ] Tab persistence (reopen on restart)
- [ ] Tab reordering (drag & drop)
- [ ] Close tab / close others / close all

#### SQL Editor
- [ ] Monaco Editor with SQL syntax highlighting
- [ ] Multi-dialect support (MySQL, PostgreSQL, SQLite)
- [ ] Autocomplete: tables, columns, keywords
- [ ] Multiple statements execution
- [ ] Keyboard shortcuts (Cmd+Enter to execute, Cmd+S to save)
- [ ] Query history (per connection)
- [ ] Save queries as snippets

#### Data Grid
- [ ] Virtualized table (render only visible rows)
- [ ] Column resizing
- [ ] Column sorting (click header)
- [ ] Column reordering
- [ ] Cell selection
- [ ] Copy cell / row / selection as SQL, CSV, JSON
- [ ] NULL value indication
- [ ] Inline cell editing (Phase 2)

#### Table Structure View
- [ ] Columns list with type, nullable, default, key info
- [ ] Indexes list
- [ ] Foreign keys list
- [ ] Table DDL (CREATE statement)

#### Query Results
- [ ] Execution time display
- [ ] Rows affected count
- [ ] Multiple result sets support
- [ ] Error display with line highlighting

### Phase 2 - Enhanced

#### Data Editing
- [ ] Inline cell editing in data grid
- [ ] Add new row
- [ ] Delete row(s)
- [ ] Commit / rollback pending changes
- [ ] Visual diff of pending changes

#### Advanced Query Features
- [ ] Query explain / execution plan
- [ ] Query formatting (beautify SQL)
- [ ] Find and replace in editor
- [ ] Multiple cursors

#### Export
- [ ] Export to CSV
- [ ] Export to JSON
- [ ] Export to SQL (INSERT statements)
- [ ] Export to Excel
- [ ] Export table structure as DDL

#### Import
- [ ] Import from CSV
- [ ] Import from SQL file
- [ ] Drag & drop file import

#### Filtering & Search
- [ ] Column filters in data grid
- [ ] Global table search (WHERE builder)
- [ ] Filter presets (save/load)

### Phase 3 - Pro Features

#### Visual Query Builder
- [ ] Drag & drop query construction
- [ ] JOIN visualization
- [ ] Generate SQL from visual

#### Schema Visualization
- [ ] ER diagram generation
- [ ] Table relationships view
- [ ] Export diagram as image

#### Collaboration
- [ ] Share connections (encrypted)
- [ ] Share query snippets
- [ ] Team workspaces (cloud sync)

#### Additional Databases
- [ ] MongoDB support
- [ ] Redis support
- [ ] SQL Server support

---

## Project Structure

```
db-studio/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
│
├── resources/                    # App icons, assets
│   └── icon.icns
│
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Main entry point
│   │   ├── ipc/                  # IPC handlers
│   │   │   ├── connection.ts     # Connection CRUD
│   │   │   ├── query.ts          # Query execution
│   │   │   └── schema.ts         # Schema introspection
│   │   ├── db/                   # Database drivers
│   │   │   ├── base.ts           # Base driver interface
│   │   │   ├── mysql.ts          # MySQL driver
│   │   │   ├── postgres.ts       # PostgreSQL driver
│   │   │   └── sqlite.ts         # SQLite driver
│   │   ├── services/
│   │   │   ├── connections.ts    # Connection manager
│   │   │   └── keychain.ts       # Secure storage
│   │   └── utils/
│   │       └── logger.ts
│   │
│   ├── preload/                  # Preload scripts
│   │   ├── index.ts              # Context bridge
│   │   └── api.ts                # Exposed API types
│   │
│   └── renderer/                 # Vue application
│       ├── index.html
│       ├── main.ts               # Vue entry point
│       ├── App.vue
│       ├── assets/
│       │   └── main.css          # Tailwind imports
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.vue
│       │   │   ├── TabBar.vue
│       │   │   └── StatusBar.vue
│       │   ├── connection/
│       │   │   ├── ConnectionList.vue
│       │   │   ├── ConnectionForm.vue
│       │   │   └── ConnectionTree.vue
│       │   ├── editor/
│       │   │   ├── SqlEditor.vue
│       │   │   └── QueryHistory.vue
│       │   ├── grid/
│       │   │   ├── DataGrid.vue
│       │   │   ├── GridCell.vue
│       │   │   └── GridToolbar.vue
│       │   └── table/
│       │       ├── TableStructure.vue
│       │       └── TableInfo.vue
│       ├── composables/
│       │   ├── useConnection.ts
│       │   ├── useQuery.ts
│       │   ├── useTabs.ts
│       │   └── useTheme.ts
│       ├── stores/
│       │   ├── connections.ts
│       │   ├── tabs.ts
│       │   └── settings.ts
│       ├── views/
│       │   ├── HomeView.vue
│       │   ├── QueryView.vue
│       │   └── TableView.vue
│       ├── types/
│       │   ├── connection.ts
│       │   ├── query.ts
│       │   └── table.ts
│       └── lib/
│           └── utils.ts          # shadcn utils
│
└── build/                        # Build configuration
    └── entitlements.mac.plist
```

---

## Database Driver Interface

Each driver must implement this interface:

```typescript
interface DatabaseDriver {
  // Connection
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  testConnection(config: ConnectionConfig): Promise<boolean>

  // Query execution
  execute(sql: string): Promise<QueryResult>
  executeMultiple(sql: string): Promise<QueryResult[]>

  // Schema introspection
  getDatabases(): Promise<Database[]>
  getSchemas(database: string): Promise<Schema[]>
  getTables(database: string, schema?: string): Promise<Table[]>
  getColumns(table: string): Promise<Column[]>
  getIndexes(table: string): Promise<Index[]>
  getForeignKeys(table: string): Promise<ForeignKey[]>
  getTableDDL(table: string): Promise<string>

  // Data operations
  getTableData(table: string, options: DataOptions): Promise<DataResult>
  updateRow(table: string, primaryKey: any, data: object): Promise<void>
  insertRow(table: string, data: object): Promise<void>
  deleteRow(table: string, primaryKey: any): Promise<void>
}
```

---

## IPC Communication

All database operations happen in the main process. The renderer communicates via IPC:

```typescript
// Preload exposes these methods to renderer
interface ElectronAPI {
  // Connections
  connections: {
    list(): Promise<Connection[]>
    create(data: ConnectionInput): Promise<Connection>
    update(id: string, data: ConnectionInput): Promise<Connection>
    delete(id: string): Promise<void>
    test(data: ConnectionInput): Promise<{ success: boolean; error?: string }>
    connect(id: string): Promise<void>
    disconnect(id: string): Promise<void>
  }

  // Queries
  query: {
    execute(connectionId: string, sql: string): Promise<QueryResult>
    cancel(queryId: string): Promise<void>
    getHistory(connectionId: string): Promise<QueryHistoryItem[]>
  }

  // Schema
  schema: {
    getDatabases(connectionId: string): Promise<Database[]>
    getTables(connectionId: string, database: string): Promise<Table[]>
    getColumns(connectionId: string, table: string): Promise<Column[]>
    getTableData(connectionId: string, table: string, options: DataOptions): Promise<DataResult>
  }
}
```

---

## UI/UX Guidelines

### Layout
- **Sidebar** (left): Connection tree, collapsible
- **Main area** (center): Tabs with content
- **Status bar** (bottom): Connection status, query time, row count

### Theme
- Dark mode by default (dev-friendly)
- Light mode option
- Follow system preference

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Execute query | `Cmd + Enter` |
| Execute selected | `Cmd + Shift + Enter` |
| New query tab | `Cmd + T` |
| Close tab | `Cmd + W` |
| Save query | `Cmd + S` |
| Format SQL | `Cmd + Shift + F` |
| Toggle sidebar | `Cmd + B` |
| Focus search | `Cmd + P` |
| Next tab | `Cmd + Shift + ]` |
| Previous tab | `Cmd + Shift + [` |

### Visual Style
- Clean, minimal interface
- Monospace font for data (JetBrains Mono, Fira Code)
- Clear visual hierarchy
- Subtle animations (no distractions)
- High contrast for readability

---

## Security Considerations

1. **Credential Storage**
   - Use OS keychain (Keychain on macOS) for passwords
   - Never store plain-text passwords
   - Encrypt connection export files

2. **IPC Security**
   - Context isolation enabled
   - Node integration disabled in renderer
   - Strict CSP headers

3. **SQL Injection**
   - Parameterized queries for data operations
   - User queries are user's responsibility (display warning)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| App startup | < 2 seconds |
| Connection time | < 1 second |
| Query execution feedback | Immediate spinner |
| Render 10k rows | < 100ms (virtualized) |
| Memory (idle, 5 connections) | < 400MB |

---

## Development Setup

```bash
# Clone and install
git clone <repo>
cd db-studio
npm install

# Development with HMR
npm run dev

# Build for macOS
npm run build:mac

# Run tests
npm run test
```

---

## MVP Checklist (First Release)

- [ ] Project setup (electron-vite, Vue 3, Tailwind, TypeScript)
- [ ] Basic layout (sidebar, tabs, status bar)
- [ ] Connection CRUD with secure storage
- [ ] SQLite driver
- [ ] PostgreSQL driver
- [ ] MySQL driver
- [ ] Database tree explorer
- [ ] SQL editor with Monaco
- [ ] Query execution and results grid
- [ ] Table data view with pagination
- [ ] Table structure view
- [ ] Dark/light theme toggle
- [ ] macOS build and notarization

---

## References

- [Beekeeper Studio](https://github.com/beekeeper-studio/beekeeper-studio) - Open source, similar product
- [TablePlus](https://tableplus.com) - Commercial inspiration
- [electron-vite](https://electron-vite.org) - Build tool docs
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Editor docs
- [TanStack Table](https://tanstack.com/table) - Grid virtualization