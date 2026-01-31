import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
const mockGetAllWindows = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
}));

import { emitQueryLog } from '../../../main/services/queryLog';
import type { QueryLogEntry } from '../../../main/services/queryLog';

describe('queryLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('emitQueryLog', () => {
    it('should send query log entry to a single window', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        timestamp: '2025-01-15T10:30:00.000Z',
      };

      emitQueryLog(entry);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('query:log', entry);
    });

    it('should send query log entry to multiple windows', () => {
      const mockSend1 = vi.fn();
      const mockSend2 = vi.fn();

      mockGetAllWindows.mockReturnValue([
        { webContents: { send: mockSend1 } },
        { webContents: { send: mockSend2 } },
      ]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'INSERT INTO logs VALUES (1)',
        timestamp: '2025-01-15T10:30:00.000Z',
      };

      emitQueryLog(entry);

      expect(mockSend1).toHaveBeenCalledWith('query:log', entry);
      expect(mockSend2).toHaveBeenCalledWith('query:log', entry);
    });

    it('should handle no open windows', () => {
      mockGetAllWindows.mockReturnValue([]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-15T10:30:00.000Z',
      };

      expect(() => emitQueryLog(entry)).not.toThrow();
    });

    it('should send entry with executionTime', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM orders WHERE id = 42',
        timestamp: '2025-01-15T10:30:00.000Z',
        executionTime: 150,
      };

      emitQueryLog(entry);

      expect(mockSend).toHaveBeenCalledWith('query:log', {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM orders WHERE id = 42',
        timestamp: '2025-01-15T10:30:00.000Z',
        executionTime: 150,
      });
    });

    it('should send entry without executionTime', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-2',
        sql: 'DROP TABLE temp',
        timestamp: '2025-06-01T00:00:00.000Z',
      };

      emitQueryLog(entry);

      expect(mockSend).toHaveBeenCalledWith('query:log', {
        connectionId: 'conn-2',
        sql: 'DROP TABLE temp',
        timestamp: '2025-06-01T00:00:00.000Z',
      });
    });

    it('should pass the exact same entry object to all windows', () => {
      const mockSend1 = vi.fn();
      const mockSend2 = vi.fn();
      const mockSend3 = vi.fn();

      mockGetAllWindows.mockReturnValue([
        { webContents: { send: mockSend1 } },
        { webContents: { send: mockSend2 } },
        { webContents: { send: mockSend3 } },
      ]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT count(*) FROM users',
        timestamp: '2025-01-15T12:00:00.000Z',
        executionTime: 42,
      };

      emitQueryLog(entry);

      // All windows should receive the exact same object reference
      expect(mockSend1.mock.calls[0][1]).toBe(entry);
      expect(mockSend2.mock.calls[0][1]).toBe(entry);
      expect(mockSend3.mock.calls[0][1]).toBe(entry);
    });

    it('should always use the query:log channel name', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-15T10:30:00.000Z',
      };

      emitQueryLog(entry);

      expect(mockSend.mock.calls[0][0]).toBe('query:log');
    });
  });
});
