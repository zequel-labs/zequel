import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportResult } from '@main/ipc/import';
import type { ImportPreview, ColumnMapping } from '@main/services/import';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockShowOpenDialog = vi.fn();
const mockGetFocusedWindow = vi.fn();
const mockIpcMainHandle = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockIpcMainHandle(...args),
  },
  dialog: {
    showOpenDialog: (...args: unknown[]) => mockShowOpenDialog(...args),
  },
  BrowserWindow: {
    getFocusedWindow: () => mockGetFocusedWindow(),
  },
  app: {
    isPackaged: false,
    getPath: () => '/tmp/test',
  },
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

const mockParseCSVFile = vi.fn();
const mockParseJSONFile = vi.fn();
const mockReadImportData = vi.fn();

vi.mock('@main/services/import', () => ({
  parseCSVFile: (...args: unknown[]) => mockParseCSVFile(...args),
  parseJSONFile: (...args: unknown[]) => mockParseJSONFile(...args),
  readImportData: (...args: unknown[]) => mockReadImportData(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

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

let registerImportHandlers: () => void;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('@main/ipc/import');
  registerImportHandlers = mod.registerImportHandlers;
  registerImportHandlers();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registerImportHandlers', () => {
  it('should register all four IPC handlers', () => {
    const channels = mockIpcMainHandle.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('import:preview');
    expect(channels).toContain('import:reparse');
    expect(channels).toContain('import:execute');
    expect(channels).toContain('import:getTableColumns');
  });
});

// ─── import:preview ──────────────────────────────────────────────────────────

describe('import:preview', () => {
  const samplePreview: ImportPreview = {
    columns: [
      { name: 'id', sampleValues: [1, 2], detectedType: 'INTEGER' },
      { name: 'name', sampleValues: ['a', 'b'], detectedType: 'VARCHAR(255)' },
    ],
    rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    totalRows: 2,
    hasHeaders: true,
  };

  it('should return error when no focused window', async () => {
    mockGetFocusedWindow.mockReturnValue(null);
    const handler = getHandler('import:preview');
    const result = (await handler({}, 'csv')) as {
      preview: ImportPreview | null;
      filePath: string | null;
      error?: string;
    };

    expect(result.preview).toBeNull();
    expect(result.filePath).toBeNull();
    expect(result.error).toBe('No focused window');
  });

  it('should return canceled state when dialog is dismissed', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const handler = getHandler('import:preview');
    const result = (await handler({}, 'csv')) as {
      preview: ImportPreview | null;
      filePath: string | null;
      error?: string;
    };

    expect(result.preview).toBeNull();
    expect(result.filePath).toBeNull();
    expect(result.error).toBe('Import canceled');
  });

  it('should call parseCSVFile for csv format', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/data.csv'],
    });
    mockParseCSVFile.mockResolvedValue(samplePreview);

    const handler = getHandler('import:preview');
    const result = (await handler({}, 'csv')) as {
      preview: ImportPreview | null;
      filePath: string | null;
    };

    expect(result.preview).toEqual(samplePreview);
    expect(result.filePath).toBe('/tmp/data.csv');
    expect(mockParseCSVFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/data.csv',
        format: 'csv',
        hasHeaders: true,
        previewLimit: 100,
      })
    );
  });

  it('should call parseJSONFile for json format', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/data.json'],
    });
    mockParseJSONFile.mockResolvedValue(samplePreview);

    const handler = getHandler('import:preview');
    const result = (await handler({}, 'json')) as {
      preview: ImportPreview | null;
      filePath: string | null;
    };

    expect(result.preview).toEqual(samplePreview);
    expect(result.filePath).toBe('/tmp/data.json');
    expect(mockParseJSONFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/data.json',
        format: 'json',
      })
    );
  });

  it('should show CSV-specific file filters for csv format', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const handler = getHandler('import:preview');
    await handler({}, 'csv');

    const dialogOptions = mockShowOpenDialog.mock.calls[0][1] as {
      title: string;
      filters: { name: string; extensions: string[] }[];
    };
    expect(dialogOptions.title).toBe('Import CSV File');
    expect(dialogOptions.filters[0].extensions).toEqual(['csv', 'tsv', 'txt']);
  });

  it('should show JSON-specific file filters for json format', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const handler = getHandler('import:preview');
    await handler({}, 'json');

    const dialogOptions = mockShowOpenDialog.mock.calls[0][1] as {
      title: string;
      filters: { name: string; extensions: string[] }[];
    };
    expect(dialogOptions.title).toBe('Import JSON File');
    expect(dialogOptions.filters[0].extensions).toEqual(['json']);
  });

  it('should handle parse errors', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/bad.csv'],
    });
    mockParseCSVFile.mockRejectedValue(new Error('Malformed CSV'));

    const handler = getHandler('import:preview');
    const result = (await handler({}, 'csv')) as {
      preview: ImportPreview | null;
      filePath: string | null;
      error?: string;
    };

    expect(result.preview).toBeNull();
    expect(result.filePath).toBeNull();
    expect(result.error).toBe('Malformed CSV');
  });

  it('should handle non-Error throws', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/bad.csv'],
    });
    mockParseCSVFile.mockRejectedValue('raw error string');

    const handler = getHandler('import:preview');
    const result = (await handler({}, 'csv')) as {
      preview: ImportPreview | null;
      error?: string;
    };

    expect(result.error).toBe('raw error string');
  });
});

// ─── import:reparse ──────────────────────────────────────────────────────────

describe('import:reparse', () => {
  const samplePreview: ImportPreview = {
    columns: [{ name: 'col1', sampleValues: ['x'], detectedType: 'VARCHAR(255)' }],
    rows: [{ col1: 'x' }],
    totalRows: 1,
    hasHeaders: true,
  };

  it('should call parseCSVFile with custom options for csv', async () => {
    mockParseCSVFile.mockResolvedValue(samplePreview);

    const handler = getHandler('import:reparse');
    const result = (await handler(
      {},
      '/tmp/data.csv',
      'csv',
      { hasHeaders: false, delimiter: '\t' }
    )) as { preview: ImportPreview | null };

    expect(result.preview).toEqual(samplePreview);
    expect(mockParseCSVFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/data.csv',
        format: 'csv',
        hasHeaders: false,
        delimiter: '\t',
        previewLimit: 100,
      })
    );
  });

  it('should call parseJSONFile for json format', async () => {
    mockParseJSONFile.mockResolvedValue(samplePreview);

    const handler = getHandler('import:reparse');
    const result = (await handler(
      {},
      '/tmp/data.json',
      'json',
      {}
    )) as { preview: ImportPreview | null };

    expect(result.preview).toEqual(samplePreview);
    expect(mockParseJSONFile).toHaveBeenCalled();
  });

  it('should return error on parse failure', async () => {
    mockParseCSVFile.mockRejectedValue(new Error('bad delimiter'));

    const handler = getHandler('import:reparse');
    const result = (await handler(
      {},
      '/tmp/data.csv',
      'csv',
      { delimiter: '|' }
    )) as { preview: ImportPreview | null; error?: string };

    expect(result.preview).toBeNull();
    expect(result.error).toBe('bad delimiter');
  });
});

// ─── import:execute ──────────────────────────────────────────────────────────

describe('import:execute', () => {
  const mockDriver = {
    execute: vi.fn().mockResolvedValue({}),
    insertRow: vi.fn().mockResolvedValue({ success: true }),
  };

  const columnMappings: ColumnMapping[] = [
    { sourceColumn: 'id', targetColumn: 'id', targetType: 'INTEGER' },
    { sourceColumn: 'name', targetColumn: 'name', targetType: 'TEXT' },
  ];

  beforeEach(() => {
    mockGetConnection.mockReturnValue(mockDriver);
    mockDriver.execute.mockResolvedValue({});
    mockDriver.insertRow.mockResolvedValue({ success: true });
  });

  it('should return error when no connection found', async () => {
    mockGetConnection.mockReturnValue(undefined);

    const handler = getHandler('import:execute');
    const result = (await handler(
      {},
      'conn-1',
      'users',
      '/tmp/data.csv',
      'csv',
      columnMappings,
      {}
    )) as ImportResult;

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Not connected to database');
  });

  it('should read data and insert rows', async () => {
    mockReadImportData.mockResolvedValue([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    const handler = getHandler('import:execute');
    const result = (await handler(
      {},
      'conn-1',
      'users',
      '/tmp/data.csv',
      'csv',
      columnMappings,
      { hasHeaders: true }
    )) as ImportResult;

    expect(result.success).toBe(true);
    expect(result.insertedRows).toBe(2);
    expect(result.filePath).toBe('/tmp/data.csv');
  });

  it('should truncate table when truncateTable option is set', async () => {
    mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }]);

    const handler = getHandler('import:execute');
    await handler(
      {},
      'conn-1',
      'users',
      '/tmp/data.csv',
      'csv',
      columnMappings,
      { truncateTable: true }
    );

    expect(mockDriver.execute).toHaveBeenCalledWith('DELETE FROM "users"');
  });

  it('should not truncate table by default', async () => {
    mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }]);

    const handler = getHandler('import:execute');
    await handler(
      {},
      'conn-1',
      'users',
      '/tmp/data.csv',
      'csv',
      columnMappings,
      {}
    );

    expect(mockDriver.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE')
    );
  });

  it('should handle truncate failure and continue importing', async () => {
    mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }]);
    mockDriver.execute.mockRejectedValueOnce(new Error('truncate failed'));

    const handler = getHandler('import:execute');
    const result = (await handler(
      {},
      'conn-1',
      'users',
      '/tmp/data.csv',
      'csv',
      columnMappings,
      { truncateTable: true }
    )) as ImportResult;

    // Import still processes rows despite truncate failure
    expect(result.insertedRows).toBe(1);
    // But should report the truncate error
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Failed to truncate table'),
      ])
    );
  });

  describe('type conversion', () => {
    it('should convert INTEGER values', async () => {
      mockReadImportData.mockResolvedValue([{ num: '42' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBe(42);
    });

    it('should convert INT values', async () => {
      mockReadImportData.mockResolvedValue([{ num: '99' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'INT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBe(99);
    });

    it('should convert BIGINT values', async () => {
      mockReadImportData.mockResolvedValue([{ num: '9999999999' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'BIGINT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBe(9999999999);
    });

    it('should convert SMALLINT values', async () => {
      mockReadImportData.mockResolvedValue([{ num: '7' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'SMALLINT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBe(7);
    });

    it('should set null for non-numeric integer strings', async () => {
      mockReadImportData.mockResolvedValue([{ num: 'abc' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBeNull();
    });

    it('should convert DECIMAL values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '3.14' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'DECIMAL' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeCloseTo(3.14);
    });

    it('should convert FLOAT values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '1.5' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'FLOAT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeCloseTo(1.5);
    });

    it('should convert DOUBLE values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '2.718' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'DOUBLE' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeCloseTo(2.718);
    });

    it('should convert REAL values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '0.5' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'REAL' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeCloseTo(0.5);
    });

    it('should convert NUMERIC values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '100.25' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'NUMERIC' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeCloseTo(100.25);
    });

    it('should set null for non-numeric float strings', async () => {
      mockReadImportData.mockResolvedValue([{ val: 'not-a-number' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'FLOAT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeNull();
    });

    it('should convert BOOLEAN true values', async () => {
      mockReadImportData.mockResolvedValue([
        { flag: 'true' },
        { flag: '1' },
        { flag: 'yes' },
      ]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'flag', targetColumn: 'flag', targetType: 'BOOLEAN' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const calls = mockDriver.insertRow.mock.calls;
      expect((calls[0][0] as { values: Record<string, unknown> }).values.flag).toBe(true);
      expect((calls[1][0] as { values: Record<string, unknown> }).values.flag).toBe(true);
      expect((calls[2][0] as { values: Record<string, unknown> }).values.flag).toBe(true);
    });

    it('should convert BOOLEAN false values', async () => {
      mockReadImportData.mockResolvedValue([
        { flag: 'false' },
        { flag: '0' },
        { flag: 'no' },
      ]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'flag', targetColumn: 'flag', targetType: 'BOOLEAN' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const calls = mockDriver.insertRow.mock.calls;
      expect((calls[0][0] as { values: Record<string, unknown> }).values.flag).toBe(false);
      expect((calls[1][0] as { values: Record<string, unknown> }).values.flag).toBe(false);
      expect((calls[2][0] as { values: Record<string, unknown> }).values.flag).toBe(false);
    });

    it('should convert BOOL type same as BOOLEAN', async () => {
      mockReadImportData.mockResolvedValue([{ flag: 'true' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'flag', targetColumn: 'flag', targetType: 'BOOL' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.flag).toBe(true);
    });

    it('should parse JSON strings for JSON type', async () => {
      mockReadImportData.mockResolvedValue([{ data: '{"key":"value"}' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'data', targetColumn: 'data', targetType: 'JSON' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.data).toEqual({ key: 'value' });
    });

    it('should parse JSON strings for JSONB type', async () => {
      mockReadImportData.mockResolvedValue([{ data: '[1,2,3]' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'data', targetColumn: 'data', targetType: 'JSONB' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.data).toEqual([1, 2, 3]);
    });

    it('should keep string for invalid JSON', async () => {
      mockReadImportData.mockResolvedValue([{ data: 'not-json' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'data', targetColumn: 'data', targetType: 'JSON' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.data).toBe('not-json');
    });

    it('should convert TEXT and default types to string', async () => {
      mockReadImportData.mockResolvedValue([{ val: 42 }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'TEXT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBe('42');
    });

    it('should set null for empty string values', async () => {
      mockReadImportData.mockResolvedValue([{ val: '' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeNull();
    });

    it('should set null for null values regardless of type', async () => {
      mockReadImportData.mockResolvedValue([{ val: null }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'TEXT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeNull();
    });

    it('should set null for undefined values regardless of type', async () => {
      mockReadImportData.mockResolvedValue([{ val: undefined }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'val', targetColumn: 'val', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.val).toBeNull();
    });

    it('should handle case-insensitive type matching', async () => {
      mockReadImportData.mockResolvedValue([{ num: '5' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'num', targetColumn: 'num', targetType: 'integer' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values.num).toBe(5);
    });
  });

  describe('column mapping', () => {
    it('should skip mappings without targetColumn', async () => {
      mockReadImportData.mockResolvedValue([{ a: '1', b: '2' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'a', targetColumn: 'col_a', targetType: 'TEXT' },
        { sourceColumn: 'b', targetColumn: '', targetType: 'TEXT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(insertCall.values).toHaveProperty('col_a');
      expect(insertCall.values).not.toHaveProperty('b');
    });

    it('should skip mappings without sourceColumn', async () => {
      mockReadImportData.mockResolvedValue([{ a: '1' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: '', targetColumn: 'col_a', targetType: 'TEXT' },
      ];

      const handler = getHandler('import:execute');
      await handler({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      const insertCall = mockDriver.insertRow.mock.calls[0][0] as {
        values: Record<string, unknown>;
      };
      expect(Object.keys(insertCall.values)).toHaveLength(0);
    });
  });

  describe('batch processing', () => {
    it('should use default batchSize of 100', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ id: String(i) }));
      mockReadImportData.mockResolvedValue(rows);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'id', targetColumn: 'id', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'tbl',
        '/tmp/d.csv',
        'csv',
        mappings,
        {}
      )) as ImportResult;

      expect(result.insertedRows).toBe(3);
      expect(mockDriver.insertRow).toHaveBeenCalledTimes(3);
    });

    it('should respect custom batchSize', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
      mockReadImportData.mockResolvedValue(rows);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'id', targetColumn: 'id', targetType: 'INTEGER' },
      ];

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'tbl',
        '/tmp/d.csv',
        'csv',
        mappings,
        { batchSize: 2 }
      )) as ImportResult;

      expect(result.insertedRows).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should collect insert errors and continue', async () => {
      mockReadImportData.mockResolvedValue([
        { id: '1', name: 'OK' },
        { id: '2', name: 'FAIL' },
        { id: '3', name: 'OK2' },
      ]);
      mockDriver.insertRow
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'constraint violation' })
        .mockResolvedValueOnce({ success: true });

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'users',
        '/tmp/d.csv',
        'csv',
        columnMappings,
        {}
      )) as ImportResult;

      expect(result.success).toBe(false);
      expect(result.insertedRows).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('constraint violation');
    });

    it('should catch insertRow exceptions', async () => {
      mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }]);
      mockDriver.insertRow.mockRejectedValueOnce(new Error('db connection lost'));

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'users',
        '/tmp/d.csv',
        'csv',
        columnMappings,
        {}
      )) as ImportResult;

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('db connection lost');
    });

    it('should limit error messages to 100', async () => {
      const rows = Array.from({ length: 150 }, (_, i) => ({
        id: String(i),
        name: 'fail',
      }));
      mockReadImportData.mockResolvedValue(rows);
      mockDriver.insertRow.mockResolvedValue({
        success: false,
        error: 'fail',
      });

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'users',
        '/tmp/d.csv',
        'csv',
        columnMappings,
        {}
      )) as ImportResult;

      expect(result.errors!.length).toBeLessThanOrEqual(100);
    });

    it('should handle readImportData failure', async () => {
      mockReadImportData.mockRejectedValue(new Error('File not found'));

      const handler = getHandler('import:execute');
      const result = (await handler(
        {},
        'conn-1',
        'users',
        '/tmp/missing.csv',
        'csv',
        columnMappings,
        {}
      )) as ImportResult;

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File not found');
    });
  });

  it('should pass correct table name and values to insertRow', async () => {
    mockReadImportData.mockResolvedValue([{ id: '10', name: 'Test' }]);

    const handler = getHandler('import:execute');
    await handler({}, 'conn-1', 'my_table', '/tmp/d.csv', 'csv', columnMappings, {});

    expect(mockDriver.insertRow).toHaveBeenCalledWith({
      table: 'my_table',
      values: { id: 10, name: 'Test' },
    });
  });

  it('should pass delimiter and hasHeaders to readImportData', async () => {
    mockReadImportData.mockResolvedValue([]);

    const handler = getHandler('import:execute');
    await handler(
      {},
      'conn-1',
      'tbl',
      '/tmp/d.tsv',
      'csv',
      [],
      { hasHeaders: false, delimiter: '\t' }
    );

    expect(mockReadImportData).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/d.tsv',
        format: 'csv',
        hasHeaders: false,
        delimiter: '\t',
      })
    );
  });
});

// ─── import:getTableColumns ──────────────────────────────────────────────────

describe('import:getTableColumns', () => {
  const mockDriver = {
    getColumns: vi.fn(),
  };

  beforeEach(() => {
    mockGetConnection.mockReturnValue(mockDriver);
  });

  it('should return columns from driver', async () => {
    const columns = [
      { name: 'id', type: 'integer', nullable: false, primaryKey: true },
      { name: 'name', type: 'text', nullable: true, primaryKey: false },
    ];
    mockDriver.getColumns.mockResolvedValue(columns);

    const handler = getHandler('import:getTableColumns');
    const result = (await handler({}, 'conn-1', 'users')) as {
      columns: typeof columns;
    };

    expect(result.columns).toEqual(columns);
    expect(mockDriver.getColumns).toHaveBeenCalledWith('users');
  });

  it('should return error when no connection found', async () => {
    mockGetConnection.mockReturnValue(undefined);

    const handler = getHandler('import:getTableColumns');
    const result = (await handler({}, 'conn-1', 'users')) as {
      columns: unknown[];
      error?: string;
    };

    expect(result.columns).toEqual([]);
    expect(result.error).toBe('Not connected to database');
  });

  it('should handle getColumns failure', async () => {
    mockDriver.getColumns.mockRejectedValue(new Error('table not found'));

    const handler = getHandler('import:getTableColumns');
    const result = (await handler({}, 'conn-1', 'missing')) as {
      columns: unknown[];
      error?: string;
    };

    expect(result.columns).toEqual([]);
    expect(result.error).toBe('table not found');
  });
});
