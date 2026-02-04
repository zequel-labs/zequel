# Zequel

A modern database management GUI for macOS built with Electron and Vue 3. Supports PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, and Redis.

## Architecture

```
src/
├── main/              # Electron main process
│   ├── db/            # Database connection managers
│   ├── ipc/           # IPC handlers (renderer ↔ main)
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

## Common Commands

```bash
npm run dev            # Start dev server
npm run build          # Production build
npm run test           # Run tests (Vitest)
npm run test:coverage  # Tests with coverage
npm run typecheck      # Type-check both main and renderer
```

## TypeScript

- Strict mode enabled everywhere
- Always type function parameters, return types, and variables
- No `any` — use proper types or `unknown`

## Enums

Prefer enums over string literal unions. Enums use string values for serialization:

```typescript
export enum DatabaseType {
  SQLite = 'sqlite',
  MySQL = 'mysql',
  PostgreSQL = 'postgresql',
}
```

Enums live in `src/renderer/types/` (frontend) or `src/main/types/` (main process).

## Functions

Always use arrow functions:

```typescript
const loadConnections = async (): Promise<void> => { ... }
```

## UI

- **Reka UI** — unstyled, accessible component primitives
- **Tailwind CSS** — utility-first styling
- **`cn()` utility** — merges classes via `clsx` + `tailwind-merge` (from `@/lib/utils`)
- **class-variance-authority (CVA)** — type-safe component variants
- **Icons** — Tabler Icons (`@tabler/icons-vue`), Lucide (`lucide-vue-next`)
- **Toasts** — Vue Sonner
- **Code editor** — Monaco Editor

## Vue Components

All components use `<script setup lang="ts">`:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  variant?: 'default' | 'outline';
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
});
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
  const connections = ref<SavedConnection[]>([]);
  const activeConnection = computed(() => { ... });

  const loadConnections = async () => { ... };

  return { connections, activeConnection, loadConnections };
});
```

## Composables

Located in `src/renderer/composables/`, named `useXxx`:

```typescript
export const useKeyboardShortcuts = () => {
  const shortcuts: KeyboardShortcut[] = [...];

  const handleKeydown = (event: KeyboardEvent) => { ... };

  onMounted(() => window.addEventListener('keydown', handleKeydown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

  return { shortcuts, handleKeydown };
};
```

## Testing

Vitest with globals enabled. Test files live in `src/tests/` mirroring the source structure.

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ConnectionService', () => {
  it('should connect to database', () => {
    expect(result).toBe('expected');
  });
});
```

Always write tests for backend and frontend functions.

## Import Aliases

| Alias | Path |
|-------|------|
| `@` | `src/renderer` |
| `@main` | `src/main` |

## Code Style

- Single quotes
- 2-space indentation
- Semicolons
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

- Never add `Co-Authored-By` to commit messages

## Package Manager

npm
