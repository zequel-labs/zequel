# Coding Guidelines

This page documents the conventions enforced across the Zequel codebase. There is no ESLint or Prettier configuration; style is enforced by convention and code review.

## TypeScript

- **Strict mode** is enabled for both the main process and the renderer (separate `tsconfig` files).
- Always type function parameters, return types, and variables.
- Never use `any`. Use proper types or `unknown` when the type is truly indeterminate.

## Functions

Always use arrow functions:

```typescript
const loadConnections = async (): Promise<void> => {
  // ...
};
```

## Enums

Prefer enums over string literal unions. Enum values use strings for safe serialization:

```typescript
export enum DatabaseType {
  SQLite = 'sqlite',
  MySQL = 'mysql',
  PostgreSQL = 'postgresql',
}
```

Enums live in `src/renderer/types/` (frontend) or `src/main/types/` (main process).

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

- **Props**: `defineProps<Props>()` with `withDefaults()` for defaults.
- **Emits**: `defineEmits<{ (e: 'event', data: Type): void }>()`.
- **Filenames**: PascalCase (`ConnectionDialog.vue`).
- **Template usage**: PascalCase (`<ConnectionDialog />`).

## Pinia Stores

Stores use the composition API and live in `src/renderer/stores/`. Follow the `useXxxStore` naming pattern:

```typescript
export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref<SavedConnection[]>([]);
  const activeConnection = computed(() => { /* ... */ });

  const loadConnections = async () => { /* ... */ };

  return { connections, activeConnection, loadConnections };
});
```

## Composables

Composables live in `src/renderer/composables/` and follow the `useXxx` naming pattern:

```typescript
export const useKeyboardShortcuts = () => {
  const shortcuts: KeyboardShortcut[] = [/* ... */];

  const handleKeydown = (event: KeyboardEvent) => { /* ... */ };

  onMounted(() => window.addEventListener('keydown', handleKeydown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

  return { shortcuts, handleKeydown };
};
```

## Import Aliases

| Alias | Path |
|---------|-----------------|
| `@` | `src/renderer` |
| `@main` | `src/main` |

## UI Stack

- **Reka UI** -- unstyled, accessible component primitives.
- **Tailwind CSS v4** -- utility-first styling.
- **`cn()` utility** -- merges classes via `clsx` + `tailwind-merge` (from `@/lib/utils`).
- **class-variance-authority (CVA)** -- type-safe component variants.
- **Icons** -- Tabler Icons (`@tabler/icons-vue`) and Lucide (`lucide-vue-next`).
- **Toasts** -- Vue Sonner.
- **Code editor** -- Monaco Editor.

## Code Style

| Rule | Convention |
|-------------------|----------------------------------------------|
| Quotes | Single quotes |
| Indentation | 2 spaces |
| Semicolons | Always |
| Line endings | LF |
| Components | PascalCase (`ConnectionDialog.vue`) |
| Composables | camelCase with `use` prefix (`useQuery.ts`) |
| Stores | camelCase with `use` prefix and `Store` suffix (`useConnectionsStore`) |
| Constants | UPPER_SNAKE_CASE |
| Enums | PascalCase names, PascalCase members |

## Package Manager

Use **npm** exclusively. Do not use yarn or pnpm.
