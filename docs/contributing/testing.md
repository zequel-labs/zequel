# Testing

Zequel uses [Vitest](https://vitest.dev/) as its test runner with globals enabled. Test files live in `src/tests/` and mirror the source tree structure.

## Test Types

### Unit Tests

Located in `src/tests/unit/`, subdivided into `renderer/` and `main/` to match the source layout. Unit tests are fast and isolated -- they do not require running databases or the full Electron environment.

### Integration Tests

Located in `src/tests/integration/`. These tests connect to real database instances started via Docker Compose. Make sure the development databases are running before executing them:

```bash
docker compose up -d
```

### End-to-End Tests

Located in `src/tests/e2e/`. These tests launch the full Electron application and interact with it programmatically.

## Commands

```bash
# Run all tests in watch mode
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only (requires Docker databases)
npm run test:integration

# Run all tests with coverage report
npm run test:coverage
```

## Writing Tests

Test files follow this structure:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ConnectionService', () => {
  it('should connect to database', () => {
    const result = connectToDatabase();
    expect(result).toBe('expected');
  });
});
```

### Conventions

- Place test files in the `src/tests/` directory mirroring the path of the source file being tested. For example, tests for `src/main/db/postgres.ts` go in `src/tests/unit/main/db/postgres.test.ts`.
- Use `describe` blocks to group related tests.
- Use `vi.fn()` and `vi.mock()` for mocking.
- Write tests for both backend (main process) and frontend (renderer) code.
- Keep unit tests free of side effects. Mock external dependencies such as database clients and IPC channels.
- Integration tests should clean up after themselves (drop temporary tables, close connections).
