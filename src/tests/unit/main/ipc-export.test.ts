import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExportOptions, ExportResult } from '@main/ipc/export';
import type { DatabaseDriver } from '@main/db/base';
import { DatabaseType } from '@main/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('');

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockShowSaveDialog = vi.fn();
const mockShowOpenDialog = vi.fn();
const mockGetFocusedWindow = vi.fn();
const mockClipboardWriteText = vi.fn();
const mockIpcMainHandle = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockIpcMainHandle(...args),
  },
  dialog: {
    showSaveDialog: (...args: unknown[]) => mockShowSaveDialog(...args),
    showOpenDialog: (...args: unknown[]) => mockShowOpenDialog(...args),
  },
  BrowserWindow: {
    getFocusedWindow: () => mockGetFocusedWindow(),
  },
  clipboard: {
    writeText: (...args: unknown[]) => mockClipboardWriteText(...args),
  },
  app: {
    isPackaged: false,
    getPath: () => '/tmp/test',
  },
}));

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => Buffer.from('fake-xlsx')),
}));

const mockGetConnection = vi.fn();

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
  },
}));

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * After importing registerExportHandlers and calling it, handlers are
 * registered via ipcMain.handle. This helper extracts a handler by channel.
 */
type HandlerFn = (...args: unknown[]) => Promise<unknown>;

const getHandler = (channel: string): HandlerFn => {
  const call = mockIpcMainHandle.mock.calls.find(
    (c: unknown[]) => c[0] === channel
  );
  if (!call) {
    throw new Error(`No handler registered for channel "${channel}"`);
  }
  return call[1] as HandlerFn;
};

// ── Setup ────────────────────────────────────────────────────────────────────

let registerExportHandlers: () => void;

beforeEach(async () => {
  vi.clearAllMocks();
  // Dynamically import so mocks are in place
  const mod = await import('@main/ipc/export');
  registerExportHandlers = mod.registerExportHandlers;
  registerExportHandlers();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registerExportHandlers', () => {
  it('should register all four IPC handlers', () => {
    const channels = mockIpcMainHandle.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('export:toFile');
    expect(channels).toContain('export:toClipboard');
    expect(channels).toContain('backup:export');
    expect(channels).toContain('backup:import');
  });
});

// ─── export:toFile ───────────────────────────────────────────────────────────

describe('export:toFile', () => {
  const baseOptions: ExportOptions = {
    format: 'csv',
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'text' },
    ],
    rows: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
    tableName: 'users',
    includeHeaders: true,
    delimiter: ',',
  };

  const setupDialogSuccess = (filePath = '/tmp/export.csv'): void => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath });
  };

  describe('CSV export', () => {
    it('should generate CSV with headers and write to file', async () => {
      setupDialogSuccess('/tmp/export.csv');
      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/tmp/export.csv');

      const writtenContent = mockWriteFile.mock.calls[0][0];
      expect(writtenContent).toBe('/tmp/export.csv');
      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('id,name');
      expect(csvContent).toContain('1,Alice');
      expect(csvContent).toContain('2,Bob');
    });

    it('should omit headers when includeHeaders is false', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, includeHeaders: false };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('1,Alice');
    });

    it('should use custom delimiter', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, delimiter: ';' };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('id;name');
      expect(csvContent).toContain('1;Alice');
    });

    it('should escape CSV fields containing delimiter', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        rows: [{ id: 1, name: 'last, first' }],
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('"last, first"');
    });

    it('should escape CSV fields containing double quotes', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        rows: [{ id: 1, name: 'say "hello"' }],
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('"say ""hello"""');
    });

    it('should escape CSV fields containing newlines', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        rows: [{ id: 1, name: 'line1\nline2' }],
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('"line1\nline2"');
    });

    it('should handle null and undefined values as empty strings', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        rows: [{ id: null, name: undefined }],
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      const dataLine = csvContent.split('\n')[1];
      expect(dataLine).toBe(',');
    });

    it('should serialize object values as JSON in CSV', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        columns: [{ name: 'data', type: 'json' }],
        rows: [{ data: { nested: true } }],
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      // JSON.stringify produces {"nested":true} which contains quotes,
      // so CSV escaping wraps it in quotes and doubles internal quotes:
      // "{""nested"":true}"
      expect(csvContent).toContain('"{""nested"":true}"');
    });

    it('should default delimiter to comma', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        delimiter: undefined,
      };
      await handler({}, opts);

      const csvContent = mockWriteFile.mock.calls[0][1] as string;
      expect(csvContent.split('\n')[0]).toBe('id,name');
    });
  });

  describe('JSON export', () => {
    it('should generate valid JSON and write to file', async () => {
      setupDialogSuccess('/tmp/export.json');
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, format: 'json' };
      const result = (await handler({}, opts)) as ExportResult;

      expect(result.success).toBe(true);
      const jsonContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>[];
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ id: 1, name: 'Alice' });
      expect(parsed[1]).toEqual({ id: 2, name: 'Bob' });
    });

    it('should pretty-print JSON with 2-space indent', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, format: 'json' };
      await handler({}, opts);

      const jsonContent = mockWriteFile.mock.calls[0][1] as string;
      expect(jsonContent).toContain('  "id"');
    });

    it('should only include specified columns', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'json',
        columns: [{ name: 'name', type: 'text' }],
        rows: [{ id: 1, name: 'Alice', extra: 'ignored' }],
      };
      await handler({}, opts);

      const jsonContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>[];
      expect(parsed[0]).toEqual({ name: 'Alice' });
      expect(parsed[0]).not.toHaveProperty('id');
      expect(parsed[0]).not.toHaveProperty('extra');
    });

    it('should handle nested objects in row data', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'json',
        columns: [{ name: 'meta', type: 'json' }],
        rows: [{ meta: { tags: ['a', 'b'], count: 2 } }],
      };
      await handler({}, opts);

      const jsonContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>[];
      expect(parsed[0].meta).toEqual({ tags: ['a', 'b'], count: 2 });
    });

    it('should handle empty rows', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'json',
        rows: [],
      };
      await handler({}, opts);

      const jsonContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent) as unknown[];
      expect(parsed).toEqual([]);
    });
  });

  describe('SQL export', () => {
    it('should generate INSERT statements', async () => {
      setupDialogSuccess('/tmp/export.sql');
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, format: 'sql' };
      const result = (await handler({}, opts)) as ExportResult;

      expect(result.success).toBe(true);
      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      const lines = sqlContent.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('INSERT INTO "users" ("id", "name") VALUES (1, \'Alice\');');
      expect(lines[1]).toBe('INSERT INTO "users" ("id", "name") VALUES (2, \'Bob\');');
    });

    it('should escape single quotes in SQL values', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        rows: [{ id: 1, name: "O'Brien" }],
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      expect(sqlContent).toContain("'O''Brien'");
    });

    it('should output NULL for null and undefined values', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        rows: [{ id: null, name: undefined }],
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      expect(sqlContent).toContain('VALUES (NULL, NULL)');
    });

    it('should output numbers without quotes', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        columns: [{ name: 'amount', type: 'decimal' }],
        rows: [{ amount: 3.14 }],
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      expect(sqlContent).toContain('VALUES (3.14)');
    });

    it('should convert booleans to 1 and 0', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        columns: [{ name: 'active', type: 'boolean' }],
        rows: [{ active: true }, { active: false }],
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      const lines = sqlContent.split('\n');
      expect(lines[0]).toContain('VALUES (1)');
      expect(lines[1]).toContain('VALUES (0)');
    });

    it('should default table name to table_name', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        tableName: undefined,
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      expect(sqlContent).toContain('INSERT INTO "table_name"');
    });

    it('should wrap string values in single quotes', async () => {
      setupDialogSuccess();
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = {
        ...baseOptions,
        format: 'sql',
        columns: [{ name: 'label', type: 'text' }],
        rows: [{ label: 'hello world' }],
      };
      await handler({}, opts);

      const sqlContent = mockWriteFile.mock.calls[0][1] as string;
      expect(sqlContent).toContain("'hello world'");
    });
  });

  describe('XLSX export', () => {
    it('should generate an XLSX buffer and write as binary', async () => {
      setupDialogSuccess('/tmp/export.xlsx');
      const handler = getHandler('export:toFile');
      const opts: ExportOptions = { ...baseOptions, format: 'xlsx' };
      const result = (await handler({}, opts)) as ExportResult;

      expect(result.success).toBe(true);
      // For binary files, writeFile is called with a Buffer, no encoding
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/export.xlsx',
        expect.any(Buffer)
      );
    });
  });

  describe('dialog interactions', () => {
    it('should return error when dialog is canceled', async () => {
      mockGetFocusedWindow.mockReturnValue({});
      mockShowSaveDialog.mockResolvedValue({ canceled: true });

      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export canceled');
    });

    it('should return error when no focused window', async () => {
      mockGetFocusedWindow.mockReturnValue(null);

      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('No focused window');
    });

    it('should return error when filePath is empty', async () => {
      mockGetFocusedWindow.mockReturnValue({});
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '' });

      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export canceled');
    });
  });

  describe('error handling', () => {
    it('should catch writeFile errors', async () => {
      mockGetFocusedWindow.mockReturnValue({});
      mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/x.csv' });
      mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'));

      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should handle unsupported format', async () => {
      mockGetFocusedWindow.mockReturnValue({});
      const handler = getHandler('export:toFile');
      const opts = { ...baseOptions, format: 'xml' as ExportOptions['format'] };
      const result = (await handler({}, opts)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });

    it('should convert non-Error throws to string', async () => {
      mockGetFocusedWindow.mockReturnValue({});
      mockShowSaveDialog.mockRejectedValueOnce('raw string error');

      const handler = getHandler('export:toFile');
      const result = (await handler({}, baseOptions)) as ExportResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('raw string error');
    });
  });
});

// ─── export:toClipboard ──────────────────────────────────────────────────────

describe('export:toClipboard', () => {
  const baseOptions: ExportOptions = {
    format: 'csv',
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'text' },
    ],
    rows: [{ id: 1, name: 'Alice' }],
  };

  it('should copy CSV content to clipboard', async () => {
    const handler = getHandler('export:toClipboard');
    const result = (await handler({}, baseOptions)) as ExportResult;

    expect(result.success).toBe(true);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('id,name')
    );
  });

  it('should copy JSON content to clipboard', async () => {
    const handler = getHandler('export:toClipboard');
    const opts: ExportOptions = { ...baseOptions, format: 'json' };
    const result = (await handler({}, opts)) as ExportResult;

    expect(result.success).toBe(true);
    const writtenText = mockClipboardWriteText.mock.calls[0][0] as string;
    const parsed = JSON.parse(writtenText) as Record<string, unknown>[];
    expect(parsed[0]).toEqual({ id: 1, name: 'Alice' });
  });

  it('should copy SQL content to clipboard', async () => {
    const handler = getHandler('export:toClipboard');
    const opts: ExportOptions = {
      ...baseOptions,
      format: 'sql',
      tableName: 'users',
    };
    const result = (await handler({}, opts)) as ExportResult;

    expect(result.success).toBe(true);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO')
    );
  });

  it('should return error for unsupported format', async () => {
    const handler = getHandler('export:toClipboard');
    const opts = { ...baseOptions, format: 'xlsx' as ExportOptions['format'] };
    const result = (await handler({}, opts)) as ExportResult;

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported export format');
  });

  it('should handle clipboard write errors', async () => {
    mockClipboardWriteText.mockImplementationOnce(() => {
      throw new Error('Clipboard unavailable');
    });

    const handler = getHandler('export:toClipboard');
    const result = (await handler({}, baseOptions)) as ExportResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Clipboard unavailable');
  });
});

// ─── backup:export ───────────────────────────────────────────────────────────

describe('backup:export', () => {
  const mockDriver = {
    type: DatabaseType.SQLite,
    getTables: vi.fn(),
    getTableDDL: vi.fn(),
    getTableData: vi.fn(),
    execute: vi.fn(),
  } as unknown as DatabaseDriver;

  beforeEach(() => {
    mockGetConnection.mockReturnValue(mockDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should return error when no connection found', async () => {
    mockGetConnection.mockReturnValue(undefined);
    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not connected to database');
  });

  it('should return error when no focused window', async () => {
    mockGetFocusedWindow.mockReturnValue(null);
    // getTables must resolve so we reach the window check
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe('No focused window');
  });

  it('should handle save dialog cancellation', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockShowSaveDialog.mockResolvedValue({ canceled: true });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Export canceled');
  });

  it('should export SQL backup with DDL and data for tables', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'users', type: 'table' },
      { name: 'user_view', type: 'view' },
    ]);
    (mockDriver.getTableDDL as ReturnType<typeof vi.fn>).mockResolvedValue(
      'CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT)'
    );
    (mockDriver.getTableData as ReturnType<typeof vi.fn>).mockResolvedValue({
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'name', type: 'text' },
      ],
      rows: [{ id: 1, name: 'Alice' }],
    });
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/backup.sql',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    expect(result.filePath).toBe('/tmp/backup.sql');

    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('-- Database Backup');
    expect(content).toContain('DROP TABLE IF EXISTS "users"');
    expect(content).toContain('CREATE TABLE "users"');
    expect(content).toContain('INSERT INTO "users"');
    // Views should not be exported as table data
    expect(content).not.toContain('user_view');
  });

  it('should handle tables with no data rows', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'empty_table', type: 'table' },
    ]);
    (mockDriver.getTableDDL as ReturnType<typeof vi.fn>).mockResolvedValue(
      'CREATE TABLE "empty_table" (id INTEGER)'
    );
    (mockDriver.getTableData as ReturnType<typeof vi.fn>).mockResolvedValue({
      columns: [{ name: 'id', type: 'integer' }],
      rows: [],
    });
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/backup.sql',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('DROP TABLE IF EXISTS "empty_table"');
    expect(content).not.toContain('INSERT INTO');
  });

  it('should add error comment when table export fails', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'bad_table', type: 'table' },
    ]);
    (mockDriver.getTableDDL as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DDL failed')
    );
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/backup.sql',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('-- Error exporting table bad_table: DDL failed');
  });

  it('should escape single quotes in SQL backup data', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'tbl', type: 'table' },
    ]);
    (mockDriver.getTableDDL as ReturnType<typeof vi.fn>).mockResolvedValue(
      'CREATE TABLE "tbl" (val TEXT)'
    );
    (mockDriver.getTableData as ReturnType<typeof vi.fn>).mockResolvedValue({
      columns: [{ name: 'val', type: 'text' }],
      rows: [{ val: "it's" }],
    });
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/backup.sql',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain("'it''s'");
  });

  it('should handle boolean and null values in SQL backup', async () => {
    (mockDriver.getTables as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'tbl', type: 'table' },
    ]);
    (mockDriver.getTableDDL as ReturnType<typeof vi.fn>).mockResolvedValue(
      'CREATE TABLE "tbl" (a BOOLEAN, b TEXT)'
    );
    (mockDriver.getTableData as ReturnType<typeof vi.fn>).mockResolvedValue({
      columns: [
        { name: 'a', type: 'boolean' },
        { name: 'b', type: 'text' },
      ],
      rows: [{ a: true, b: null }],
    });
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/backup.sql',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('1, NULL');
  });
});

// ─── backup:import (SQL) ─────────────────────────────────────────────────────

describe('backup:import', () => {
  const mockSqlDriver = {
    type: DatabaseType.SQLite,
    execute: vi.fn(),
  } as unknown as DatabaseDriver;

  beforeEach(() => {
    mockGetConnection.mockReturnValue(mockSqlDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should return error when no connection found', async () => {
    mockGetConnection.mockReturnValue(undefined);
    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Not connected to database');
  });

  it('should return error when no focused window', async () => {
    mockGetFocusedWindow.mockReturnValue(null);
    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No focused window');
  });

  it('should handle open dialog cancellation', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Import canceled');
  });

  it('should execute SQL statements from file', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/backup.sql'],
    });
    mockReadFile.mockResolvedValue(
      'CREATE TABLE t (id INT);\nINSERT INTO t VALUES (1);\nINSERT INTO t VALUES (2);'
    );
    (mockSqlDriver.execute as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(true);
    expect(result.statements).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip comment-only statements', async () => {
    // The import logic splits by ";", trims, then filters out empty and
    // lines starting with "--". Comments on their own between semicolons
    // are skipped.
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/backup.sql'],
    });
    mockReadFile.mockResolvedValue(
      '-- comment;\nCREATE TABLE t (id INT);\n-- another comment;'
    );
    (mockSqlDriver.execute as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(true);
    // "-- comment" is filtered, "CREATE TABLE t (id INT)" executes,
    // "-- another comment" is filtered
    expect(result.statements).toBe(1);
  });

  it('should skip empty statements', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/backup.sql'],
    });
    mockReadFile.mockResolvedValue('SELECT 1;  ;  ;SELECT 2;');
    (mockSqlDriver.execute as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(true);
    expect(result.statements).toBe(2);
  });

  it('should collect errors for failing statements and continue', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/backup.sql'],
    });
    mockReadFile.mockResolvedValue(
      'SELECT 1;\nBAD SQL;\nSELECT 2;'
    );
    const execMock = mockSqlDriver.execute as ReturnType<typeof vi.fn>;
    execMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('syntax error'))
      .mockResolvedValueOnce({});

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.statements).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('syntax error');
  });

  it('should return the filePath', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/data.sql'],
    });
    mockReadFile.mockResolvedValue('SELECT 1;');
    (mockSqlDriver.execute as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      filePath?: string;
    };

    expect(result.filePath).toBe('/tmp/data.sql');
  });
});

// ─── backup:export Redis ─────────────────────────────────────────────────────

describe('backup:export (Redis)', () => {
  const mockClient = {
    type: vi.fn().mockResolvedValue('string'),
    ttl: vi.fn().mockResolvedValue(-1),
    get: vi.fn().mockResolvedValue('val'),
    lrange: vi.fn().mockResolvedValue(['a', 'b']),
    smembers: vi.fn().mockResolvedValue(['x', 'y']),
    hgetall: vi.fn().mockResolvedValue({ f1: 'v1' }),
    zrange: vi.fn().mockResolvedValue(['m1', '1', 'm2', '2']),
    xrange: vi.fn().mockResolvedValue([]),
  };

  const mockRedisDriver = {
    type: DatabaseType.Redis,
    getClient: vi.fn(() => mockClient),
    getAllKeys: vi.fn().mockResolvedValue(['key1', 'key2']),
  };

  beforeEach(() => {
    // Re-set defaults after vi.clearAllMocks() in the top-level beforeEach
    mockClient.type.mockResolvedValue('string');
    mockClient.ttl.mockResolvedValue(-1);
    mockClient.get.mockResolvedValue('hello');
    mockClient.lrange.mockResolvedValue(['a', 'b']);
    mockClient.smembers.mockResolvedValue(['x', 'y']);
    mockClient.hgetall.mockResolvedValue({ f1: 'v1' });
    mockClient.zrange.mockResolvedValue(['m1', '1', 'm2', '2']);
    mockClient.xrange.mockResolvedValue([]);
    mockRedisDriver.getClient.mockReturnValue(mockClient);
    mockRedisDriver.getAllKeys.mockResolvedValue(['key1', 'key2']);
    mockGetConnection.mockReturnValue(mockRedisDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should export Redis keys as JSON', async () => {
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      _meta: { type: string; keyCount: number };
      data: Record<string, unknown>;
    };
    expect(parsed._meta.type).toBe('redis');
    expect(parsed._meta.keyCount).toBe(2);
    expect(parsed.data).toHaveProperty('key1');
    expect(parsed.data).toHaveProperty('key2');
  });

  it('should handle list type keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['mylist']);
    mockClient.type.mockResolvedValue('list');
    mockClient.lrange.mockResolvedValue(['a', 'b', 'c']);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['mylist'].type).toBe('list');
    expect(parsed.data['mylist'].value).toEqual(['a', 'b', 'c']);
  });

  it('should handle set type keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['myset']);
    mockClient.type.mockResolvedValue('set');
    mockClient.smembers.mockResolvedValue(['x', 'y']);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['myset'].type).toBe('set');
    expect(parsed.data['myset'].value).toEqual(['x', 'y']);
  });

  it('should handle hash type keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['myhash']);
    mockClient.type.mockResolvedValue('hash');
    mockClient.hgetall.mockResolvedValue({ field1: 'value1' });
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['myhash'].type).toBe('hash');
    expect(parsed.data['myhash'].value).toEqual({ field1: 'value1' });
  });

  it('should handle zset type keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['myzset']);
    mockClient.type.mockResolvedValue('zset');
    mockClient.zrange.mockResolvedValue(['member1', '10', 'member2', '20']);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['myzset'].type).toBe('zset');
    expect(parsed.data['myzset'].value).toEqual([
      { member: 'member1', score: '10' },
      { member: 'member2', score: '20' },
    ]);
  });

  it('should handle stream type keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['mystream']);
    mockClient.type.mockResolvedValue('stream');
    mockClient.xrange.mockResolvedValue([
      ['1-0', ['field1', 'val1', 'field2', 'val2']],
    ]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['mystream'].type).toBe('stream');
    expect(parsed.data['mystream'].value).toEqual([
      { _id: '1-0', field1: 'val1', field2: 'val2' },
    ]);
  });

  it('should store null for unknown key types', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['unknown_key']);
    mockClient.type.mockResolvedValue('weird_type');
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { type: string; value: unknown }>;
    };
    expect(parsed.data['unknown_key'].value).toBeNull();
  });

  it('should record TTL for keys', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['expiring']);
    mockClient.type.mockResolvedValue('string');
    mockClient.get.mockResolvedValue('temp');
    mockClient.ttl.mockResolvedValue(300);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, { ttl: number }>;
    };
    expect(parsed.data['expiring'].ttl).toBe(300);
  });

  it('should continue exporting when a key fails', async () => {
    mockRedisDriver.getAllKeys.mockResolvedValue(['good', 'bad']);
    mockClient.type
      .mockResolvedValueOnce('string')
      .mockRejectedValueOnce(new Error('connection lost'));
    mockClient.get.mockResolvedValue('val');
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/redis.json',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      _meta: { keyCount: number };
      data: Record<string, unknown>;
    };
    expect(parsed._meta.keyCount).toBe(1);
    expect(parsed.data).toHaveProperty('good');
    expect(parsed.data).not.toHaveProperty('bad');
  });
});

// ─── backup:export MongoDB ───────────────────────────────────────────────────

describe('backup:export (MongoDB)', () => {
  const mockToArray = vi.fn().mockResolvedValue([{ _id: 'abc', name: 'doc1' }]);
  const mockLimit = vi.fn().mockReturnValue({ toArray: mockToArray });
  const mockFind = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockCollection = {
    find: mockFind,
  };

  const mockListToArray = vi.fn().mockResolvedValue([{ name: 'users', type: 'collection' }]);
  const mockDb = {
    listCollections: vi.fn().mockReturnValue({ toArray: mockListToArray }),
    collection: vi.fn().mockReturnValue(mockCollection),
  };

  const mockMongoDriver = {
    type: DatabaseType.MongoDB,
    getDb: vi.fn(() => mockDb),
  };

  beforeEach(() => {
    // Re-set defaults after vi.clearAllMocks() in the top-level beforeEach
    mockToArray.mockResolvedValue([{ _id: 'abc', name: 'doc1' }]);
    mockLimit.mockReturnValue({ toArray: mockToArray });
    mockFind.mockReturnValue({ limit: mockLimit });
    mockListToArray.mockResolvedValue([{ name: 'users', type: 'collection' }]);
    mockDb.listCollections.mockReturnValue({ toArray: mockListToArray });
    mockDb.collection.mockReturnValue(mockCollection);
    mockMongoDriver.getDb.mockReturnValue(mockDb);
    mockGetConnection.mockReturnValue(mockMongoDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should export MongoDB collections as JSON', async () => {
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      _meta: { type: string; collectionCount: number; totalDocuments: number };
      data: Record<string, unknown[]>;
    };
    expect(parsed._meta.type).toBe('mongodb');
    expect(parsed._meta.collectionCount).toBe(1);
    expect(parsed.data).toHaveProperty('users');
  });

  it('should skip system collections', async () => {
    mockListToArray.mockResolvedValue([
      { name: 'system.indexes', type: 'collection' },
      { name: 'actual', type: 'collection' },
    ]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, unknown[]>;
    };
    expect(parsed.data).not.toHaveProperty('system.indexes');
    expect(parsed.data).toHaveProperty('actual');
  });

  it('should skip views', async () => {
    mockListToArray.mockResolvedValue([
      { name: 'myview', type: 'view' },
      { name: 'real', type: 'collection' },
    ]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, unknown[]>;
    };
    expect(parsed.data).not.toHaveProperty('myview');
    expect(parsed.data).toHaveProperty('real');
  });

  it('should serialize Date objects as $date', async () => {
    const date = new Date('2025-01-15T10:00:00.000Z');
    mockToArray.mockResolvedValue([{ _id: '1', created: date }]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, Record<string, unknown>[]>;
    };
    const doc = parsed.data['users'][0];
    expect(doc.created).toEqual({ $date: '2025-01-15T10:00:00.000Z' });
  });

  it('should serialize ObjectId-like objects as $oid', async () => {
    const fakeObjectId = { toHexString: () => '507f1f77bcf86cd799439011' };
    mockToArray.mockResolvedValue([{ _id: fakeObjectId }]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, Record<string, unknown>[]>;
    };
    const doc = parsed.data['users'][0];
    expect(doc._id).toEqual({ $oid: '507f1f77bcf86cd799439011' });
  });

  it('should handle Buffer values as $binary', async () => {
    const buf = Buffer.from('binary data');
    mockToArray.mockResolvedValue([{ _id: '1', blob: buf }]);
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    await handler({}, 'conn-1');

    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, Record<string, unknown>[]>;
    };
    const doc = parsed.data['users'][0];
    expect(doc.blob).toEqual({ $binary: buf.toString('base64') });
  });

  it('should handle collection export failure gracefully', async () => {
    mockListToArray.mockResolvedValue([
      { name: 'failing', type: 'collection' },
    ]);
    mockToArray.mockRejectedValue(new Error('cursor timeout'));
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/mongo.json',
    });

    const handler = getHandler('backup:export');
    const result = (await handler({}, 'conn-1')) as ExportResult;

    expect(result.success).toBe(true);
    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content) as {
      data: Record<string, unknown[]>;
    };
    // Failed collection has empty array
    expect(parsed.data['failing']).toEqual([]);
  });
});

// ─── backup:import Redis ─────────────────────────────────────────────────────

describe('backup:import (Redis)', () => {
  const mockClient = {
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    hset: vi.fn().mockResolvedValue(1),
    zadd: vi.fn().mockResolvedValue(1),
    xadd: vi.fn().mockResolvedValue('id'),
    expire: vi.fn().mockResolvedValue(1),
  };

  const mockRedisDriver = {
    type: DatabaseType.Redis,
    getClient: vi.fn(() => mockClient),
  };

  beforeEach(() => {
    // Re-set defaults after vi.clearAllMocks() in the top-level beforeEach
    mockClient.set.mockResolvedValue('OK');
    mockClient.del.mockResolvedValue(1);
    mockClient.rpush.mockResolvedValue(1);
    mockClient.sadd.mockResolvedValue(1);
    mockClient.hset.mockResolvedValue(1);
    mockClient.zadd.mockResolvedValue(1);
    mockClient.xadd.mockResolvedValue('id');
    mockClient.expire.mockResolvedValue(1);
    mockRedisDriver.getClient.mockReturnValue(mockClient);
    mockGetConnection.mockReturnValue(mockRedisDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should import string keys', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        mykey: { type: 'string', value: 'hello', ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(true);
    expect(result.statements).toBe(1);
    expect(mockClient.set).toHaveBeenCalledWith('mykey', 'hello');
    // TTL -1 means no expiry, so expire should not be called
    expect(mockClient.expire).not.toHaveBeenCalled();
  });

  it('should import list keys', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        mylist: { type: 'list', value: ['a', 'b', 'c'], ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
    };

    expect(result.success).toBe(true);
    expect(mockClient.del).toHaveBeenCalledWith('mylist');
    expect(mockClient.rpush).toHaveBeenCalledWith('mylist', 'a', 'b', 'c');
  });

  it('should import set keys', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        myset: { type: 'set', value: ['x', 'y'], ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    expect(mockClient.del).toHaveBeenCalledWith('myset');
    expect(mockClient.sadd).toHaveBeenCalledWith('myset', 'x', 'y');
  });

  it('should import hash keys', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        myhash: { type: 'hash', value: { f1: 'v1', f2: 'v2' }, ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    expect(mockClient.del).toHaveBeenCalledWith('myhash');
    expect(mockClient.hset).toHaveBeenCalledWith('myhash', 'f1', 'v1', 'f2', 'v2');
  });

  it('should restore TTL when positive', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        expiring: { type: 'string', value: 'temp', ttl: 600 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    expect(mockClient.expire).toHaveBeenCalledWith('expiring', 600);
  });

  it('should skip null/undefined string values', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        nullkey: { type: 'string', value: null, ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
    };

    expect(result.statements).toBe(1);
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('should skip empty list values', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        emptylist: { type: 'list', value: [], ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    expect(mockClient.rpush).not.toHaveBeenCalled();
  });

  it('should handle import errors per key and continue', async () => {
    const backup = {
      _meta: { type: 'redis', version: 1 },
      data: {
        good: { type: 'string', value: 'ok', ttl: -1 },
        bad: { type: 'string', value: 'fail', ttl: -1 },
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));
    mockClient.set
      .mockResolvedValueOnce('OK')
      .mockRejectedValueOnce(new Error('write error'));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.statements).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('write error');
  });

  it('should support plain format without _meta wrapper', async () => {
    const backup = {
      mykey: { type: 'string', value: 'plain', ttl: -1 },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/redis.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
    };

    expect(result.success).toBe(true);
    expect(result.statements).toBe(1);
    expect(mockClient.set).toHaveBeenCalledWith('mykey', 'plain');
  });
});

// ─── backup:import MongoDB ───────────────────────────────────────────────────

describe('backup:import (MongoDB)', () => {
  const mockInsertMany = vi.fn().mockResolvedValue({ insertedCount: 1 });
  const mockMongoCollection = {
    insertMany: mockInsertMany,
  };
  const mockMongoDb = {
    collection: vi.fn().mockReturnValue(mockMongoCollection),
  };
  const mockMongoDriver = {
    type: DatabaseType.MongoDB,
    getDb: vi.fn(() => mockMongoDb),
  };

  beforeEach(() => {
    // Re-set defaults after vi.clearAllMocks() in the top-level beforeEach
    mockInsertMany.mockResolvedValue({ insertedCount: 1 });
    mockMongoCollection.insertMany = mockInsertMany;
    mockMongoDb.collection.mockReturnValue(mockMongoCollection);
    mockMongoDriver.getDb.mockReturnValue(mockMongoDb);
    mockGetConnection.mockReturnValue(mockMongoDriver);
    mockGetFocusedWindow.mockReturnValue({});
  });

  it('should import MongoDB collections from wrapped format', async () => {
    const backup = {
      _meta: { type: 'mongodb', version: 1 },
      data: {
        users: [{ name: 'Alice' }],
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(true);
    expect(result.statements).toBe(1);
    expect(mockMongoDb.collection).toHaveBeenCalledWith('users');
    expect(mockInsertMany).toHaveBeenCalled();
  });

  it('should import MongoDB collections from plain format', async () => {
    const backup = {
      products: [{ name: 'Widget' }],
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
    };

    expect(result.success).toBe(true);
    expect(mockMongoDb.collection).toHaveBeenCalledWith('products');
  });

  it('should skip _meta key during import', async () => {
    const backup = {
      _meta: { type: 'mongodb' },
      data: {
        _meta: [{ shouldSkip: true }],
        real: [{ name: 'data' }],
      },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    // _meta collection should be skipped; only 'real' is imported
    const collectionCalls = mockMongoDb.collection.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(collectionCalls).not.toContain('_meta');
    expect(collectionCalls).toContain('real');
  });

  it('should skip empty collections', async () => {
    const backup = {
      data: {
        empty: [],
        nonempty: [{ name: 'item' }],
      },
      _meta: { type: 'mongodb' },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    const collectionCalls = mockMongoDb.collection.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(collectionCalls).not.toContain('empty');
    expect(collectionCalls).toContain('nonempty');
  });

  it('should deserialize $date markers back to Date objects', async () => {
    const backup = {
      data: {
        events: [{ created: { $date: '2025-06-01T12:00:00.000Z' } }],
      },
      _meta: { type: 'mongodb' },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    const insertedDocs = mockInsertMany.mock.calls[0][0] as Record<string, unknown>[];
    expect(insertedDocs[0].created).toBeInstanceOf(Date);
    expect((insertedDocs[0].created as Date).toISOString()).toBe('2025-06-01T12:00:00.000Z');
  });

  it('should deserialize $oid markers to hex strings', async () => {
    const backup = {
      data: {
        items: [{ _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test' }],
      },
      _meta: { type: 'mongodb' },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    const insertedDocs = mockInsertMany.mock.calls[0][0] as Record<string, unknown>[];
    expect(insertedDocs[0]._id).toBe('507f1f77bcf86cd799439011');
  });

  it('should deserialize $numberLong to number', async () => {
    const backup = {
      data: {
        items: [{ count: { $numberLong: '9999999999' } }],
      },
      _meta: { type: 'mongodb' },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));

    const handler = getHandler('backup:import');
    await handler({}, 'conn-1');

    const insertedDocs = mockInsertMany.mock.calls[0][0] as Record<string, unknown>[];
    expect(insertedDocs[0].count).toBe(9999999999);
  });

  it('should handle batch insert errors and continue', async () => {
    const backup = {
      data: {
        bigcoll: Array.from({ length: 5 }, (_, i) => ({ name: `doc${i}` })),
      },
      _meta: { type: 'mongodb' },
    };
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/mongo.json'],
    });
    mockReadFile.mockResolvedValue(JSON.stringify(backup));
    mockInsertMany.mockRejectedValueOnce(new Error('duplicate key'));

    const handler = getHandler('backup:import');
    const result = (await handler({}, 'conn-1')) as {
      success: boolean;
      statements: number;
      errors: string[];
    };

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('duplicate key');
  });
});
