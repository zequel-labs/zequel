import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock statement helpers
const mockRun = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
}));

// Mock appDatabase
vi.mock('@main/services/database', () => ({
  appDatabase: {
    getDatabase: vi.fn(() => ({
      prepare: mockPrepare,
    })),
  },
}));

import { settingsService } from '@main/services/settings';
import { logger } from '@main/utils/logger';

describe('SettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
  });

  describe('get', () => {
    it('should return value when key exists', () => {
      mockGet.mockReturnValueOnce({ value: 'test-value' });

      const result = settingsService.get('theme');

      expect(result).toBe('test-value');
      expect(mockPrepare).toHaveBeenCalledWith('SELECT value FROM settings WHERE key = ?');
      expect(mockGet).toHaveBeenCalledWith('theme');
    });

    it('should return null when key does not exist', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = settingsService.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should return null when row value is undefined', () => {
      mockGet.mockReturnValueOnce({});

      const result = settingsService.get('empty-key');

      expect(result).toBeNull();
    });

    it('should handle database errors and return null', () => {
      mockGet.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const result = settingsService.get('error-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get setting', {
        key: 'error-key',
        error: expect.any(Error),
      });
    });

    it('should handle prepare errors and return null', () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('SQL syntax error');
      });

      const result = settingsService.get('bad-query');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get setting', {
        key: 'bad-query',
        error: expect.any(Error),
      });
    });

    it('should pass the key parameter correctly', () => {
      mockGet.mockReturnValueOnce({ value: 'some-value' });

      settingsService.get('my-setting-key');

      expect(mockGet).toHaveBeenCalledWith('my-setting-key');
    });

    it('should return empty string when value is empty', () => {
      mockGet.mockReturnValueOnce({ value: '' });

      const result = settingsService.get('empty-string-key');

      expect(result).toBe('');
    });

    it('should handle special characters in key', () => {
      mockGet.mockReturnValueOnce({ value: 'special-value' });

      const result = settingsService.get('key.with.dots');

      expect(result).toBe('special-value');
      expect(mockGet).toHaveBeenCalledWith('key.with.dots');
    });
  });

  describe('set', () => {
    it('should insert a new setting when key does not exist', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('new-key', 'new-value');

      expect(mockPrepare).toHaveBeenCalledWith(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      );
      expect(mockRun).toHaveBeenCalledWith('new-key', 'new-value');
    });

    it('should update existing setting when key already exists', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      settingsService.set('existing-key', 'updated-value');

      expect(mockRun).toHaveBeenCalledWith('existing-key', 'updated-value');
    });

    it('should handle empty string value', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('empty-value-key', '');

      expect(mockRun).toHaveBeenCalledWith('empty-value-key', '');
    });

    it('should handle special characters in value', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('json-key', '{"test": "value"}');

      expect(mockRun).toHaveBeenCalledWith('json-key', '{"test": "value"}');
    });

    it('should throw and log error on database failure', () => {
      const dbError = new Error('Database write failed');
      mockRun.mockImplementationOnce(() => {
        throw dbError;
      });

      expect(() => settingsService.set('fail-key', 'fail-value')).toThrow('Database write failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to set setting', {
        key: 'fail-key',
        error: dbError,
      });
    });

    it('should throw and log error on prepare failure', () => {
      const prepareError = new Error('SQL prepare failed');
      mockPrepare.mockImplementationOnce(() => {
        throw prepareError;
      });

      expect(() => settingsService.set('bad-sql', 'value')).toThrow('SQL prepare failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to set setting', {
        key: 'bad-sql',
        error: prepareError,
      });
    });

    it('should handle very long values', () => {
      const longValue = 'x'.repeat(10000);
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('long-value-key', longValue);

      expect(mockRun).toHaveBeenCalledWith('long-value-key', longValue);
    });

    it('should handle unicode characters in value', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('unicode-key', '你好世界 🌍');

      expect(mockRun).toHaveBeenCalledWith('unicode-key', '你好世界 🌍');
    });

    it('should use upsert to avoid duplicate key errors', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('upsert-key', 'value1');

      const prepareCalls = mockPrepare.mock.calls as unknown[][];
      expect(prepareCalls.length).toBeGreaterThan(0);
      const sql = prepareCalls[0][0] as string;
      expect(sql).toContain('ON CONFLICT(key)');
      expect(sql).toContain('DO UPDATE SET');
    });

    it('should update timestamp on both insert and update', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });

      settingsService.set('timestamp-key', 'value');

      const prepareCalls = mockPrepare.mock.calls as unknown[][];
      expect(prepareCalls.length).toBeGreaterThan(0);
      const sql = prepareCalls[0][0] as string;
      expect(sql).toContain('updated_at = datetime(\'now\')');
    });
  });

  describe('delete', () => {
    it('should delete setting by key', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      settingsService.delete('delete-key');

      expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?');
      expect(mockRun).toHaveBeenCalledWith('delete-key');
    });

    it('should not throw when deleting non-existent key', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      expect(() => settingsService.delete('nonexistent-key')).not.toThrow();
      expect(mockRun).toHaveBeenCalledWith('nonexistent-key');
    });

    it('should throw and log error on database failure', () => {
      const dbError = new Error('Database delete failed');
      mockRun.mockImplementationOnce(() => {
        throw dbError;
      });

      expect(() => settingsService.delete('fail-key')).toThrow('Database delete failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to delete setting', {
        key: 'fail-key',
        error: dbError,
      });
    });

    it('should throw and log error on prepare failure', () => {
      const prepareError = new Error('SQL prepare failed');
      mockPrepare.mockImplementationOnce(() => {
        throw prepareError;
      });

      expect(() => settingsService.delete('bad-sql')).toThrow('SQL prepare failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to delete setting', {
        key: 'bad-sql',
        error: prepareError,
      });
    });

    it('should handle special characters in key', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      settingsService.delete('key:with:colons');

      expect(mockRun).toHaveBeenCalledWith('key:with:colons');
    });

    it('should pass the key parameter correctly', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      settingsService.delete('my-delete-key');

      expect(mockRun).toHaveBeenCalledWith('my-delete-key');
    });
  });

  describe('integration scenarios', () => {
    it('should be able to set and get the same value', () => {
      // Set
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      settingsService.set('theme', 'dark');

      // Get
      mockGet.mockReturnValueOnce({ value: 'dark' });
      const result = settingsService.get('theme');

      expect(result).toBe('dark');
    });

    it('should be able to update a value multiple times', () => {
      // First set
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      settingsService.set('counter', '1');

      // Update
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      settingsService.set('counter', '2');

      // Verify update was called
      expect(mockRun).toHaveBeenCalledTimes(2);
      expect(mockRun).toHaveBeenLastCalledWith('counter', '2');
    });

    it('should return null after deleting a key', () => {
      // Delete
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      settingsService.delete('temp-key');

      // Get should return null
      mockGet.mockReturnValueOnce(undefined);
      const result = settingsService.get('temp-key');

      expect(result).toBeNull();
    });

    it('should handle multiple different keys independently', () => {
      // Set key1
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      settingsService.set('key1', 'value1');

      // Set key2
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 2 });
      settingsService.set('key2', 'value2');

      // Get key1
      mockGet.mockReturnValueOnce({ value: 'value1' });
      const result1 = settingsService.get('key1');

      // Get key2
      mockGet.mockReturnValueOnce({ value: 'value2' });
      const result2 = settingsService.get('key2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle null database object gracefully', () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new TypeError('Cannot read properties of null');
      });

      expect(() => settingsService.set('key', 'value')).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle timeout errors', () => {
      mockRun.mockImplementationOnce(() => {
        throw new Error('Database locked');
      });

      expect(() => settingsService.set('locked-key', 'value')).toThrow('Database locked');
      expect(logger.error).toHaveBeenCalledWith('Failed to set setting', {
        key: 'locked-key',
        error: expect.any(Error),
      });
    });

    it('should handle get errors without throwing', () => {
      mockGet.mockImplementationOnce(() => {
        throw new Error('Read error');
      });

      const result = settingsService.get('error-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get setting', {
        key: 'error-key',
        error: expect.any(Error),
      });
    });
  });

  describe('settingsService singleton', () => {
    it('should export a singleton instance', () => {
      expect(settingsService).toBeDefined();
      expect(typeof settingsService.get).toBe('function');
      expect(typeof settingsService.set).toBe('function');
      expect(typeof settingsService.delete).toBe('function');
    });
  });
});
