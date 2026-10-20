# Zequel

A modern database management GUI for macOS, Windows, and Linux built with Electron and Vue 3. Supports PostgreSQL, MySQL, MariaDB, SQLite, DuckDB, ClickHouse, SQL Server, MongoDB, and Redis.

## Working in This Repository

- Read the relevant implementation and neighboring tests before changing behavior.
- Use `package.json`, runtime code, and tool configuration as the source of truth. Contributor guides in `docs/contributing/` provide context but may lag behind the implementation.
- Keep changes focused; do not reformat unrelated code or generated output.
- Preserve cross-platform behavior, database-specific capabilities, and existing user data.

## Architecture

```
src/
├── main/              # Electron main process
│   ├── db/            # Database adapters, connection manager, streaming cursors
│   ├── ipc/           # IPC handlers (renderer ↔ main)
│   ├── migrations/    # Ordered migrations for the app's local SQLite database
│   ├── services/      # DB services (connections, queries, schema)
│   ├── types/         # Main-process types
│   └── utils/         # Utilities (logger, etc.)
├── preload/           # Electron preload scripts
├── renderer/          # Vue 3 frontend
│   ├── components/    # Vue components (PascalCase filenames)
│   │   └── ui/        # Reka UI wrapped primitives
│   ├── composables/   # useXxx() composables
│   ├── stores/        # Pinia stores (useXxxStore pattern)
│   ├── types/         # Frontend types and enums
│   ├── lib/           # Utilities (cn(), formatters, SQL helpers)
│   ├── directives/    # Vue directives
│   └── views/         # Page-level components
└── tests/
    ├── unit/          # Unit tests (mirrors src/ structure)
    │   ├── renderer/
    │   └── main/
    ├── integration/
    └── e2e/
```

`docs/` contains the VitePress documentation, `docker/` contains database fixtures, and `.github/workflows/` defines CI, documentation deployment, and releases.

## Common Commands

```bash
npm run dev            # Start dev server
npm run build          # Production build
npm ci                 # Install locked dependencies (CI uses Node.js 20)
npm test               # Vitest interactive/watch mode during development
npm run test:run       # Unit + integration tests, single run (no E2E)
npm run test:unit      # Run unit tests only
npm run test:integration # Integration tests (check database prerequisites)
npm run test:e2e       # Playwright against the built Electron app
npm run test:coverage  # Tests with coverage
npm run typecheck      # Type-check both main and renderer
npm run docs:dev       # VitePress documentation dev server
npm run docs:build     # Build documentation
```

`npm run build` compiles to `out/`; packaging uses `build:unpack`, `build:mac`, `build:win`, or `build:linux`, with artifacts in `dist/`. Native dependencies are prepared by the `postinstall` script; preserve the existing Electron build configuration.

## TypeScript

- Strict mode enabled everywhere
- Type function parameters and public contracts explicitly; use inference for obvious local values and Vue/Pinia state, as neighboring code does
- Do not introduce `any` — use proper types or `unknown`; existing exceptions are not a template for new code
- Use `import type` for type-only imports

## Enums

Prefer existing enums for shared domain values. String literal unions are also used for local UI variants and settings; do not convert them solely for style. Enums use string values for serialization:

```typescript
export enum DatabaseType {
  SQLite = 'sqlite',
  MySQL = 'mysql',
  PostgreSQL = 'postgresql',
}
```

Enums live in `src/renderer/types/` (frontend) or `src/main/types/` (main process).

## Functions

Use arrow functions for standalone functions and callbacks. Existing service and driver classes use regular methods and constructors:

```typescript
const loadConnections = async (): Promise<void> => { ... }
```

## UI

- **Reka UI** — unstyled, accessible component primitives
- **Tailwind CSS v4** — utility-first styling, configured through the Vite plugin and CSS
- **`cn()` utility** — merges classes via `clsx` + `tailwind-merge` (from `@/lib/utils`)
- **class-variance-authority (CVA)** — type-safe component variants
- **Icons** — Tabler Icons (`@tabler/icons-vue`), Lucide (`lucide-vue-next`)
- **Toasts** — Vue Sonner
- **Code editor** — Monaco Editor

Reuse components in `src/renderer/components/ui/` and semantic theme tokens from `src/renderer/assets/css/main.css`. Check both light and dark themes and preserve keyboard/focus behavior when changing interactive UI.

## Vue Components

All components use `<script setup lang="ts">`:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'default' | 'outline'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})
</script>

<template>
  <div :class="cn('base-classes', props.class)">
    <slot />
  </div>
</template>
```

- Props: `defineProps<Props>()` with `withDefaults()` for defaults
- Emits: `defineEmits<{ (e: 'event', data: Type): void }>()`
- PascalCase component filenames and template usage

## State Management

Pinia stores with composition API in `src/renderer/stores/`:

```typescript
export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref<SavedConnection[]>([])
  const activeConnection = computed(() => { ... })

  const loadConnections = async () => { ... }

  return { connections, activeConnection, loadConnections }
})
```

## Composables

Located in `src/renderer/composables/`, named `useXxx`:

```typescript
export const useKeyboardShortcuts = () => {
  const shortcuts: KeyboardShortcut[] = [...]

  const handleKeydown = (event: KeyboardEvent) => { ... }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

  return { shortcuts, handleKeydown }
}
```

## Testing

Vitest with globals enabled. Test files live in `src/tests/` mirroring the source structure:

- **Unit tests** (`src/tests/unit/`) — mock-based, no external dependencies
- **Integration tests** (`src/tests/integration/`) — local database and server-backed behavior, including Docker seed data
- **E2E tests** (`src/tests/e2e/`) — Playwright tests against the built Electron app

For behavior changes, add meaningful regression coverage in the affected main/renderer tests. Check error paths and resource cleanup when relevant.

- Vitest runs in a **Node** environment; do not assume a DOM or component mounting library is configured. Follow the neighboring tests' mocks.
- `src/tests/setup.ts` is not registered as a global `setupFiles` entry in `vitest.config.ts`.
- Run `npm run typecheck` and `npm run test:unit` for code changes; these are also the CI checks on macOS, Windows, and Linux. Run targeted integration/E2E tests when changing the corresponding behavior.
- Use `npx vitest run <test-file>` for a focused single run. `npm test` may keep watching.
- `npm run typecheck` covers main/preload and renderer, not all test files. E2E has its own `tsconfig.e2e.json`.
- Documentation-only changes do not require the application test suite; check referenced paths, commands, and examples instead. Build VitePress when changing its pages or configuration.
- Report unavailable dependencies or skipped database cases rather than treating them as verified behavior.

## Import Aliases

| Alias | Path | Scope |
|-------|------|-------|
| `@` | `src/renderer` | Renderer, Vitest; also available to the main/preload TypeScript configuration |
| `@main` | `src/main` | Main, preload, Vitest |
| `@e2e` | `src/tests/e2e` | E2E tests (Playwright) |

- **Renderer/Vue code**: use `@/` for project imports. `@main/` is not configured in the renderer; access main-process operations through `window.api`
- **Main/preload code**: always use `@main/` alias — never use relative paths with `../`
- **E2E tests**: always use `@e2e/` alias — never use relative paths with `../`
- **Filesystem paths** (e.g. Electron's `preload: join(__dirname, ...)`): use `__dirname` — these are runtime paths, not module imports
- **Integration tests**: use `resolve(process.cwd(), 'path/from/root')` for project-root-relative paths

Existing sibling imports (`./...`) are common; preserve them when unrelated to the change.

## Electron and IPC Contracts

- Keep database drivers, filesystem access, credentials, and OS operations in the main process. The renderer uses the typed `window.api` bridge.
- For an IPC change, update the handler in `src/main/ipc/`, its registration in `src/main/ipc/index.ts` when needed, the bridge in `src/preload/index.ts`, and **`src/renderer/types/electron.d.ts`**, which defines `ElectronAPI`. `src/preload/index.d.ts` only declares `Window.api`.
- Keep corresponding main and renderer request/result types and enum values compatible; they are maintained separately.
- Follow existing plain-object serialization at the preload boundary (`toPlain`). Dispose of event subscriptions when their owning component or lifecycle ends.
- Reuse the IPC helpers in `src/main/ipc/helpers.ts`, including session ownership checks for session-scoped operations.
- Distinguish a saved connection ID from a live session ID. `connectionManager.connect()` creates a session; database operations use that session even where parameters are named `connectionId`. Preserve window ownership and session transfer behavior.

## Database Drivers and Persistence

- `src/main/db/base.ts` defines `DatabaseDriver` and `BaseDriver`; `src/main/db/manager.ts` manages driver instances and sessions. Extend those contracts rather than bypassing them in UI code.
- Check each affected engine's behavior when changing shared query/schema logic. Do not assume SQL syntax, transactions, or schema capabilities are identical across engines.
- Follow existing parameter binding and identifier quoting in adapters. Keep streaming/cursor cancellation, disconnect cleanup, and transaction lifecycle intact.
- The app's own SQLite database is separate from databases opened by the user: `src/main/services/database.ts` selects `zequel-dev.db` in development and `zequel.db` otherwise under Electron's `userData`.
- Add a new numbered migration in `src/main/migrations/` and register it in `index.ts` for local schema changes. Preserve existing data and test upgrades from the prior schema. Do not rewrite an already-applied migration: the runner tracks completed names and skips them.
- Database passwords use `src/main/services/keychain.ts` (`keytar`). Preserve that storage path and avoid logging credentials.
- `npm run migrate:fresh` drops tables in the local development app database; it is not a routine setup or validation command.

## Code Style

- Single quotes
- 2-space indentation
- No statement-ending semicolons in TypeScript/Vue scripts, matching current source; CSS declarations still use semicolons
- LF line endings
- **Components**: PascalCase (`ConnectionDialog.vue`)
- **Composables**: camelCase with `use` prefix (`useQuery.ts`)
- **Stores**: camelCase with `use` prefix and `Store` suffix (`useConnectionsStore`)
- **Constants**: UPPER_SNAKE_CASE
- **Enums**: PascalCase names, PascalCase members
- No ESLint or Prettier — style enforced by convention

## App Icons

Source icon is `resources/icon-1024.png` (1024x1024). To regenerate all platform icons (PNGs, `.icns`, `.ico`) into `build/icons/`:

```bash
npx electron-icon-builder --input resources/icon-1024.png --output build
```

## Git

- **Never commit directly to `main`** — always create a feature/fix branch (e.g., `feat/dark-mode`, `fix/backup-validation`) and open a pull request
- Never add `Co-Authored-By` to commit messages
- **Husky** pre-commit hook runs `npm run typecheck && npm run test:unit` before each commit
- **Conventional Commits** enforced by commit-msg hook:
  - Format: `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`
  - Examples: `feat: add dark mode support`, `fix(sidebar): resolve tree expand bug`

## Docker Development

Docker Compose provides development services for PostgreSQL, MySQL, MariaDB, MongoDB, Redis, SQL Server, and ClickHouse, with engine-specific seed data. SQLite and DuckDB are embedded engines, not Compose services.

```bash
docker-compose up -d       # Start all database containers
docker-compose down        # Stop containers, retain volumes
```

Integration tests in `src/tests/integration/` include local SQLite tests and server-backed tests. Some server-backed cases skip or return early when a connection is unavailable. Check each test's environment variables and ports: older tests and seeded Docker tests do not all share the same defaults. Use disposable test databases for mutation tests.

`docker-compose down -v` deletes the development volumes; use `docker-compose down` when retaining data.

**Note:** SQLite uses a pre-built `docker/sqlite/zequel.db` file. If `docker/sqlite/init.sql` is modified, regenerate it:

```bash
rm docker/sqlite/zequel.db && sqlite3 docker/sqlite/zequel.db < docker/sqlite/init.sql
```

E2E tests require a build first: `npm run build` then `npx playwright test src/tests/e2e/tests/<file>.test.ts`. The helper in `src/tests/e2e/helpers/app.ts` launches `out/main/index.js` with `E2E=1`. That flag alone does not establish an isolated `userData` directory; inspect fixture/setup behavior before running tests against an existing local profile. Playwright is configured for one worker.

## Package Manager

Use npm and keep `package-lock.json` in sync with dependency changes. Do not introduce yarn or pnpm lockfiles.
