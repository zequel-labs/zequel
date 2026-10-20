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
    fromWebContents: () => mockGetFocusedWindow(),
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
  streamImportData: async function* (...args: unknown[]) { yield* await mockReadImportData(...args) },
}));

vi.mock('@main/utils/pathValidation', () => ({
  isPathAllowed: vi.fn(() => true),
  allowSelectedPath: vi.fn(),
}));

vi.mock('@main/ipc/helpers', () => ({
  assertSessionOwner: vi.fn(),
}));

vi.mock('@main/services/windowManager', () => ({
  windowManager: {
    getSessionOwner: vi.fn(),
  },
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
  const handler = call[1] as HandlerFn;
  return (event, ...args) => handler({ ...(event as object), sender: { id: 1, ...(event as { sender?: object }).sender } }, ...args);
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
    const result = (await handler({ sender: {} }, 'csv')) as {
      preview: ImportPreview | null;
      filePath: string | null;
      error?: string;
    };

    expect(result.preview).toBeNull();
    expect(result.filePath).toBeNull();
    expect(result.error).toBe('No active window');
  });

  it('should return canceled state when dialog is dismissed', async () => {
    mockGetFocusedWindow.mockReturnValue({});
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const handler = getHandler('import:preview');
    const result = (await handler({ sender: {} }, 'csv')) as {
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
    const result = (await handler({ sender: {} }, 'csv')) as {
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
    const result = (await handler({ sender: {} }, 'json')) as {
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
    await handler({ sender: {} }, 'csv');

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
    await handler({ sender: {} }, 'json');

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
    const result = (await handler({ sender: {} }, 'csv')) as {
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
    const result = (await handler({ sender: {} }, 'csv')) as {
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
    type: undefined as string | undefined,
    supportsTransactions: false,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    getColumns: vi.fn(),
    cancelQuery: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({}),
    insertRow: vi.fn().mockResolvedValue({ success: true }),
  };

  const columnMappings: ColumnMapping[] = [
    { sourceColumn: 'id', targetColumn: 'id', targetType: 'INTEGER' },
    { sourceColumn: 'name', targetColumn: 'name', targetType: 'TEXT' },
  ];

  beforeEach(() => {
    mockDriver.supportsTransactions = false;
    mockDriver.type = undefined;
    mockGetConnection.mockReturnValue(mockDriver);
    mockDriver.getColumns.mockResolvedValue([{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'TEXT' }, { name: 'col_a', type: 'TEXT' }]);
    mockDriver.execute.mockResolvedValue({});
    mockDriver.insertRow.mockReset().mockResolvedValue({ success: true });
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

  it('rolls back clearing and earlier batches when a later batch fails', async () => {
    mockDriver.type = 'postgresql';
    mockDriver.supportsTransactions = true;
    mockReadImportData.mockResolvedValue([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    mockDriver.execute.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({ error: 'constraint failure' });
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { truncateTable: true, batchSize: 1 }) as ImportResult;
    expect(result).toMatchObject({ success: false, insertedRows: 0 });
    expect(mockDriver.execute).toHaveBeenNthCalledWith(1, 'DELETE FROM "users"', undefined, true);
    expect(mockDriver.beginTransaction).toHaveBeenCalledOnce();
    expect(mockDriver.rollbackTransaction).toHaveBeenCalledOnce();
    expect(mockDriver.commitTransaction).not.toHaveBeenCalled();
  });

  it('commits after every batch succeeds', async () => {
    mockDriver.type = 'postgresql';
    mockDriver.supportsTransactions = true;
    mockReadImportData.mockResolvedValue([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { batchSize: 1 }) as ImportResult;
    expect(result).toMatchObject({ success: true, insertedRows: 2 });
    expect(mockDriver.commitTransaction).toHaveBeenCalledOnce();
    expect(mockDriver.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('parses the next batch while the previous write is in flight, never sending two writes at once', async () => {
    mockDriver.type = 'postgresql';
    mockDriver.supportsTransactions = true;
    const events: string[] = [];
    let pass = 0;
    mockReadImportData.mockImplementation(() => {
      const current = ++pass;
      return (function* () {
        for (const id of [1, 2, 3]) {
          if (current === 2) events.push(`parsed ${id}`);
          yield { id, name: 'n' };
        }
      })();
    });
    let active = 0;
    mockDriver.execute.mockImplementation(async () => {
      if (++active > 1) throw new Error('Two writes in flight');
      events.push('write start');
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      events.push('write end');
      return {};
    });
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { batchSize: 1 }) as ImportResult;
    expect(result).toMatchObject({ success: true, insertedRows: 3 });
    expect(events).toEqual(['parsed 1', 'write start', 'parsed 2', 'write end', 'write start', 'parsed 3', 'write end', 'write start', 'write end']);
    expect(mockDriver.commitTransaction).toHaveBeenCalledOnce();
  });

  it('waits for the in-flight write before rolling back after a later parse failure', async () => {
    mockDriver.type = 'postgresql';
    mockDriver.supportsTransactions = true;
    const events: string[] = [];
    let pass = 0;
    mockReadImportData.mockImplementation(() => {
      const current = ++pass;
      return (function* () {
        yield { id: 1, name: 'n' };
        if (current === 2) throw new Error('Malformed CSV at line 3');
        yield { id: 2, name: 'n' };
      })();
    });
    mockDriver.execute.mockImplementation(async () => {
      events.push('write start');
      await new Promise(resolve => setTimeout(resolve, 5));
      events.push('write end');
      return {};
    });
    mockDriver.rollbackTransaction.mockImplementationOnce(async () => { events.push('rollback') });
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { batchSize: 1 }) as ImportResult;
    expect(result).toMatchObject({ success: false, insertedRows: 0, errors: ['Malformed CSV at line 3'] });
    expect(events).toEqual(['write start', 'write end', 'rollback']);
    expect(mockDriver.commitTransaction).not.toHaveBeenCalled();
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

    expect(mockDriver.execute).toHaveBeenCalledWith('DELETE FROM "users"', undefined, false);
  });

  it('writes NULL as a literal in batch INSERTs instead of an untyped parameter', async () => {
    mockDriver.type = 'sqlserver';
    mockReadImportData.mockResolvedValue([{ id: '1', name: null }, { id: null, name: 'B' }]);
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, {}) as ImportResult;
    expect(result).toMatchObject({ success: true, insertedRows: 2 });
    expect(mockDriver.execute).toHaveBeenCalledWith('INSERT INTO [users] ([id], [name]) VALUES (?, NULL), (NULL, ?)', ['1', 'B'], false);
  });

  it('imports MongoDB JSON as whole typed documents, into new fields, without inventing nulls', async () => {
    mockDriver.type = 'mongodb';
    mockDriver.getColumns.mockResolvedValue([{ name: '_id', type: 'ObjectId' }]);
    const insertRows = vi.fn().mockResolvedValue(undefined);
    Object.assign(mockDriver, { insertRows });
    try {
      mockReadImportData.mockResolvedValue([
        { _id: { $oid: '6ad7af9fb900e6f5f1a9e97b' }, big: { $numberLong: '9007199254740993' }, nested: { a: [1] } },
        { _id: { $oid: '6ad7af9fb900e6f5f1a9e97c' }, label: 'only here' },
      ]);
      const mappings = ['_id', 'big', 'nested', 'label'].map(name => ({ sourceColumn: name, targetColumn: name === 'label' ? 'renamed' : name, targetType: '' }));
      const result = await getHandler('import:execute')({}, 'conn-1', 'items', '/tmp/data.json', 'json', mappings, {}) as ImportResult;
      expect(result).toMatchObject({ success: true, insertedRows: 2 });
      expect(mockReadImportData).toHaveBeenCalledWith(expect.objectContaining({ documents: true }), expect.anything());
      const [, documents] = insertRows.mock.calls[0];
      expect(Object.keys(documents[0])).toEqual(['_id', 'big', 'nested']);
      expect(documents[0].big._bsontype).toBe('Long');
      expect(documents[0].big.toString()).toBe('9007199254740993');
      expect(documents[0]._id.toHexString()).toBe('6ad7af9fb900e6f5f1a9e97b');
      expect({ ...documents[1] }).toEqual({ _id: expect.anything(), renamed: 'only here' });
      expect(mockDriver.insertRow).not.toHaveBeenCalled();
    } finally {
      delete (mockDriver as { insertRows?: unknown }).insertRows;
    }
  });

  it('refuses file import into Redis, whose key types only Backup and Restore recreate', async () => {
    mockDriver.type = 'redis';
    mockReadImportData.mockResolvedValue([{ key: 'a', value: '1' }]);
    const result = await getHandler('import:execute')({}, 'conn-1', 'keys', '/tmp/data.csv', 'csv', [{ sourceColumn: 'key', targetColumn: 'key', targetType: '' }], {}) as ImportResult;
    expect(result).toMatchObject({ success: false, insertedRows: 0, errors: ['Redis keys are restored through Backup and Restore; file import is not supported'] });
    expect(mockDriver.insertRow).not.toHaveBeenCalled();
  });

  it('imports ClickHouse rows in native batches instead of one INSERT per row', async () => {
    mockDriver.type = 'clickhouse';
    const insertRows = vi.fn().mockResolvedValue(undefined);
    Object.assign(mockDriver, { insertRows });
    try {
      mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }]);
      const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { batchSize: 2 }) as ImportResult;
      expect(result).toMatchObject({ success: true, insertedRows: 3 });
      expect(insertRows).toHaveBeenCalledTimes(2);
      expect(insertRows).toHaveBeenNthCalledWith(1, 'users', [{ id: '1', name: 'A' }, { id: '2', name: 'B' }], undefined);
      expect(mockDriver.insertRow).not.toHaveBeenCalled();

      insertRows.mockRejectedValueOnce(new Error('Cannot parse input'));
      const failed = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { batchSize: 2 }) as ImportResult;
      expect(failed).toMatchObject({ success: false, insertedRows: 0, errors: ['Batch starting at row 1: Cannot parse input'] });
    } finally {
      delete (mockDriver as { insertRows?: unknown }).insertRows;
    }
  });

  it('clears ClickHouse tables with TRUNCATE, which completes before inserts start', async () => {
    mockDriver.type = 'clickhouse';
    mockReadImportData.mockResolvedValue([{ id: '1', name: 'A' }]);
    const result = await getHandler('import:execute')({}, 'conn-1', 'users', '/tmp/data.csv', 'csv', columnMappings, { truncateTable: true }) as ImportResult;
    expect(result.success).toBe(true);
    expect(mockDriver.execute).toHaveBeenCalledWith('TRUNCATE TABLE `users`', undefined, false);
    expect(mockDriver.execute).not.toHaveBeenCalledWith(expect.stringContaining('DELETE'), undefined, false);
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

  it('should stop before inserting if clearing the table fails', async () => {
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

    expect(result.success).toBe(false);
    expect(mockDriver.insertRow).not.toHaveBeenCalled();
    expect(result.errors).toEqual([expect.stringContaining('truncate failed')]);
  });

  describe('type conversion', () => {
    it.each([
      ['BIGINT', '9007199254740993', '9007199254740993'],
      ['NUMERIC(30,8)', '123456789012345678.12345678', '123456789012345678.12345678'],
      ['INT4', '42', '42'],
      ['FLOAT', '1.5', 1.5],
      ['BOOLEAN', 'false', false],
      ['BOOLEAN', 'yes', true],
      ['JSONB', '{"key":"value"}', '{"key":"value"}'],
      ['TEXT', '', ''],
      ['TEXT', 'NULL', 'NULL'],
      ['TEXT', null, null],
    ])('preserves %s values using database metadata', async (type, input, expected) => {
      mockDriver.getColumns.mockResolvedValue([{ name: 'value', type }]);
      mockReadImportData.mockResolvedValue([{ value: input }]);
      const result = await getHandler('import:execute')({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', [
        { sourceColumn: 'value', targetColumn: 'value', targetType: 'TEXT' },
      ], {}) as ImportResult;
      expect(result.success).toBe(true);
      expect(mockDriver.insertRow).toHaveBeenCalledWith(expect.objectContaining({ values: { value: expected } }));
    });

    it.each([['INT', '123abc'], ['FLOAT', 'NaN'], ['BOOLEAN', 'maybe'], ['JSON', 'not-json'], ['INT', '']])(
      'rejects invalid %s instead of silently writing NULL', async (type, value) => {
        mockDriver.getColumns.mockResolvedValue([{ name: 'value', type }]);
        mockReadImportData.mockResolvedValue([{ value }]);
        const result = await getHandler('import:execute')({}, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', [
          { sourceColumn: 'value', targetColumn: 'value', targetType: type },
        ], {}) as ImportResult;
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(mockDriver.insertRow).not.toHaveBeenCalled();
      },
    );
  });

  describe('column mapping', () => {
    it('should skip mappings without targetColumn', async () => {
      mockReadImportData.mockResolvedValue([{ a: '1', b: '2' }]);
      const mappings: ColumnMapping[] = [
        { sourceColumn: 'a', targetColumn: 'col_a', targetType: 'TEXT' },
        { sourceColumn: 'b', targetColumn: '', targetType: 'TEXT' },
      ];

      const handler = getHandler('import:execute');
      await handler({ sender: {} }, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

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
      await handler({ sender: {} }, 'conn-1', 'tbl', '/tmp/d.csv', 'csv', mappings, {});

      expect(mockDriver.insertRow).not.toHaveBeenCalled();
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
    it('stops on the first insert error and reports applied rows', async () => {
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
      expect(result.insertedRows).toBe(1);
      expect(mockDriver.insertRow).toHaveBeenCalledTimes(2);
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
    await handler({ sender: {} }, 'conn-1', 'my_table', '/tmp/d.csv', 'csv', columnMappings, {});

    expect(mockDriver.insertRow).toHaveBeenCalledWith({
      table: 'my_table',
      schema: undefined,
      values: { id: '10', name: 'Test' },
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
      columnMappings,
      { hasHeaders: false, delimiter: '\t' }
    );

    expect(mockReadImportData).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/d.tsv',
        format: 'csv',
        hasHeaders: false,
        delimiter: '\t',
      }), expect.any(AbortSignal)
    );
  });
});

// ─── import:getTableColumns ──────────────────────────────────────────────────

describe('import:getTableColumns', () => {
  const mockDriver = {
    getColumns: vi.fn(),
    cancelQuery: vi.fn().mockResolvedValue(true),
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
    const result = (await handler({ sender: {} }, 'conn-1', 'users')) as {
      columns: typeof columns;
    };

    expect(result.columns).toEqual(columns);
    expect(mockDriver.getColumns).toHaveBeenCalledWith('users', undefined);
  });

  it('should return error when no connection found', async () => {
    mockGetConnection.mockReturnValue(undefined);

    const handler = getHandler('import:getTableColumns');
    const result = (await handler({ sender: {} }, 'conn-1', 'users')) as {
      columns: unknown[];
      error?: string;
    };

    expect(result.columns).toEqual([]);
    expect(result.error).toBe('Not connected to database');
  });

  it('should handle getColumns failure', async () => {
    mockDriver.getColumns.mockRejectedValue(new Error('table not found'));

    const handler = getHandler('import:getTableColumns');
    const result = (await handler({ sender: {} }, 'conn-1', 'missing')) as {
      columns: unknown[];
      error?: string;
    };

    expect(result.columns).toEqual([]);
    expect(result.error).toBe('table not found');
  });
});

vi.mock('@main/services/row-transfer-context', () => ({ createRowTransferContext: async () => {
  const driver = mockGetConnection()
  if (!driver) throw new Error('Not connected to database')
  return { driver, close: async () => {} }
} }))
