import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../../../main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
  },
}));

vi.mock('../../../main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock('../../../main/utils/serialize', () => ({
  toPlainObject: vi.fn(<T>(obj: T): T => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('../../../main/ipc/helpers', () => ({
  withDriver: vi.fn(),
}));

import { ipcMain } from 'electron';
import { connectionManager } from '../../../main/db/manager';
import { withDriver } from '../../../main/ipc/helpers';
import { toPlainObject } from '../../../main/utils/serialize';
import { registerQueryHandlers, splitSqlStatements } from '../../../main/ipc/query';

const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls;
  const match = calls.find((c) => c[0] === channel);
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return match[1] as (...args: unknown[]) => unknown;
};

describe('splitSqlStatements', () => {
  it('should split simple statements by semicolons', () => {
    const result = splitSqlStatements('SELECT 1; SELECT 2;');
    expect(result).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('should handle a statement without trailing semicolon', () => {
    const result = splitSqlStatements('SELECT 1');
    expect(result).toEqual(['SELECT 1']);
  });

  it('should ignore empty statements', () => {
    const result = splitSqlStatements('SELECT 1;; ; SELECT 2');
    expect(result).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('should not split on semicolons inside single-quoted strings', () => {
    const result = splitSqlStatements("SELECT 'hello; world'; SELECT 2");
    expect(result).toEqual(["SELECT 'hello; world'", 'SELECT 2']);
  });

  it('should handle escaped single quotes inside strings', () => {
    const result = splitSqlStatements("SELECT 'it''s'; SELECT 2");
    expect(result).toEqual(["SELECT 'it''s'", 'SELECT 2']);
  });

  it('should not split on semicolons inside double-quoted identifiers', () => {
    const result = splitSqlStatements('SELECT "col;name" FROM t; SELECT 2');
    expect(result).toEqual(['SELECT "col;name" FROM t', 'SELECT 2']);
  });

  it('should handle escaped double quotes', () => {
    const result = splitSqlStatements('SELECT "col""name"; SELECT 2');
    expect(result).toEqual(['SELECT "col""name"', 'SELECT 2']);
  });

  it('should not split on semicolons inside backtick-quoted identifiers', () => {
    const result = splitSqlStatements('SELECT `col;name` FROM t; SELECT 2');
    expect(result).toEqual(['SELECT `col;name` FROM t', 'SELECT 2']);
  });

  it('should handle escaped backticks', () => {
    const result = splitSqlStatements('SELECT `col``name`; SELECT 2');
    expect(result).toEqual(['SELECT `col``name`', 'SELECT 2']);
  });

  it('should not split on semicolons inside line comments', () => {
    const result = splitSqlStatements('SELECT 1 -- this; comment\n; SELECT 2');
    expect(result).toEqual(['SELECT 1 -- this; comment', 'SELECT 2']);
  });

  it('should not split on semicolons inside block comments', () => {
    const result = splitSqlStatements('SELECT 1 /* this; comment */; SELECT 2');
    expect(result).toEqual(['SELECT 1 /* this; comment */', 'SELECT 2']);
  });

  it('should handle an empty string', () => {
    const result = splitSqlStatements('');
    expect(result).toEqual([]);
  });

  it('should handle whitespace-only input', () => {
    const result = splitSqlStatements('   ;  ;   ');
    expect(result).toEqual([]);
  });

  it('should handle multiple complex statements', () => {
    const sql = `
      CREATE TABLE users (id INT, name VARCHAR(100));
      INSERT INTO users VALUES (1, 'John; Doe');
      SELECT * FROM users WHERE name = 'test'
    `;
    const result = splitSqlStatements(sql);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('CREATE TABLE users (id INT, name VARCHAR(100))');
    expect(result[1]).toBe("INSERT INTO users VALUES (1, 'John; Doe')");
    expect(result[2]).toBe("SELECT * FROM users WHERE name = 'test'");
  });
});

describe('registerQueryHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerQueryHandlers();
  });

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(registeredChannels).toContain('query:execute');
    expect(registeredChannels).toContain('query:executeMultiple');
    expect(registeredChannels).toContain('query:cancel');
  });

  describe('query:execute', () => {
    it('should call withDriver and execute the SQL', async () => {
      const mockResult = { columns: [], rows: [], rowCount: 0, executionTime: 10 };
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriverInstance = {
          execute: vi.fn().mockResolvedValue(mockResult),
        };
        return fn(mockDriverInstance as unknown as import('../../../main/db/base').DatabaseDriver);
      });

      const handler = getHandler('query:execute');
      const result = await handler({}, 'conn-1', 'SELECT 1');

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function));
      expect(toPlainObject).toHaveBeenCalledWith(mockResult);
      expect(result).toEqual(mockResult);
    });

    it('should pass params to driver.execute', async () => {
      const executeMock = vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0, executionTime: 5 });
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriverInstance = { execute: executeMock };
        return fn(mockDriverInstance as unknown as import('../../../main/db/base').DatabaseDriver);
      });

      const handler = getHandler('query:execute');
      await handler({}, 'conn-1', 'SELECT $1', [42]);

      expect(executeMock).toHaveBeenCalledWith('SELECT $1', [42]);
    });
  });

  describe('query:executeMultiple', () => {
    it('should split SQL and execute each statement', async () => {
      const mockResult1 = { columns: [], rows: [{ id: 1 }], rowCount: 1, executionTime: 5 };
      const mockResult2 = { columns: [], rows: [{ id: 2 }], rowCount: 1, executionTime: 3 };
      const executeMock = vi.fn()
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriverInstance = { execute: executeMock };
        return fn(mockDriverInstance as unknown as import('../../../main/db/base').DatabaseDriver);
      });

      const handler = getHandler('query:executeMultiple');
      const result = await handler({}, 'conn-1', 'SELECT 1; SELECT 2');

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function));
      expect(executeMock).toHaveBeenCalledTimes(2);
      expect(executeMock).toHaveBeenCalledWith('SELECT 1');
      expect(executeMock).toHaveBeenCalledWith('SELECT 2');
      expect(toPlainObject).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [mockResult1, mockResult2],
          totalExecutionTime: expect.any(Number),
        })
      );
    });

    it('should skip empty statements', async () => {
      const executeMock = vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0, executionTime: 1 });
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriverInstance = { execute: executeMock };
        return fn(mockDriverInstance as unknown as import('../../../main/db/base').DatabaseDriver);
      });

      const handler = getHandler('query:executeMultiple');
      await handler({}, 'conn-1', 'SELECT 1; ;');

      expect(executeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('query:cancel', () => {
    it('should cancel query when driver exists', async () => {
      const mockDriver = { cancelQuery: vi.fn().mockReturnValue(true) };
      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('query:cancel');
      const result = await handler({}, 'conn-1');

      expect(connectionManager.getConnection).toHaveBeenCalledWith('conn-1');
      expect(mockDriver.cancelQuery).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when driver does not exist', async () => {
      vi.mocked(connectionManager.getConnection).mockReturnValue(undefined);

      const handler = getHandler('query:cancel');
      const result = await handler({}, 'non-existent');

      expect(result).toBe(false);
    });
  });
});
