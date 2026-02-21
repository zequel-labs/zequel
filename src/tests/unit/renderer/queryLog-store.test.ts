import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQueryLogStore } from '@/stores/queryLog';
import { useConnectionsStore } from '@/stores/connections';
import type { QueryLogEntry } from '@/stores/queryLog';

// Mock window.api
const mockOnEntry = vi.fn();
const mockRemoveListener = vi.fn();

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
    queryLog: {
      onEntry: mockOnEntry,
      removeListener: mockRemoveListener,
    },
  },
});

// Helper: register session IDs in the connections store so the ownership filter passes
const registerSessions = (...sessionIds: string[]) => {
  const connectionsStore = useConnectionsStore();
  for (const id of sessionIds) {
    connectionsStore.sessions.set(id, { savedConnectionId: id });
  }
};

describe('QueryLog Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty entries', () => {
      const store = useQueryLogStore();
      expect(store.entries).toEqual([]);
    });
  });

  describe('init', () => {
    it('should register onEntry listener', () => {
      const store = useQueryLogStore();
      store.init();
      expect(mockOnEntry).toHaveBeenCalledOnce();
      expect(mockOnEntry).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not register listener twice', () => {
      const store = useQueryLogStore();
      store.init();
      store.init();
      expect(mockOnEntry).toHaveBeenCalledOnce();
    });

    it('should return early when window.api.queryLog is undefined', () => {
      // Temporarily remove queryLog from api
      const originalQueryLog = window.api.queryLog;
      (window as { api: { queryLog?: typeof originalQueryLog } }).api.queryLog = undefined;

      const store = useQueryLogStore();
      store.init();

      expect(mockOnEntry).not.toHaveBeenCalled();

      // Restore
      (window as { api: { queryLog?: typeof originalQueryLog } }).api.queryLog = originalQueryLog;
    });

    it('should push entries when listener fires', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      // Get the callback that was registered
      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      const entry: QueryLogEntry = {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        timestamp: '2025-01-01T00:00:00Z',
        executionTime: 42,
      };

      callback(entry);

      expect(store.entries).toHaveLength(1);
      expect(store.entries[0]).toEqual(entry);
    });

    it('should accumulate multiple entries', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 2',
        timestamp: '2025-01-01T00:00:01Z',
        executionTime: 10,
      });

      expect(store.entries).toHaveLength(2);
      expect(store.entries[0].sql).toBe('SELECT 1');
      expect(store.entries[1].sql).toBe('SELECT 2');
    });

    it('should ignore entries from unregistered sessions', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      // Entry from registered session — accepted
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      // Entry from unregistered session — rejected
      callback({
        connectionId: 'foreign-session',
        sql: 'SELECT 2',
        timestamp: '2025-01-01T00:00:01Z',
      });

      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].connectionId).toBe('conn-1');
    });

    it('should accept entries from multiple registered sessions', () => {
      registerSessions('conn-1', 'conn-2');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });
      callback({
        connectionId: 'conn-2',
        sql: 'SELECT 2',
        timestamp: '2025-01-01T00:00:01Z',
      });

      expect(store.entries).toHaveLength(2);
      expect(store.entries[0].connectionId).toBe('conn-1');
      expect(store.entries[1].connectionId).toBe('conn-2');
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      expect(store.entries).toHaveLength(1);

      store.clear();
      expect(store.entries).toEqual([]);
    });

    it('should handle clearing empty entries', () => {
      const store = useQueryLogStore();
      store.clear();
      expect(store.entries).toEqual([]);
    });
  });

  describe('clearForConnection', () => {
    it('should remove entries for specified connection only', () => {
      registerSessions('conn-1', 'conn-2');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });
      callback({
        connectionId: 'conn-2',
        sql: 'SELECT 2',
        timestamp: '2025-01-01T00:00:01Z',
      });
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 3',
        timestamp: '2025-01-01T00:00:02Z',
      });

      expect(store.entries).toHaveLength(3);

      store.clearForConnection('conn-1');

      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].connectionId).toBe('conn-2');
      expect(store.entries[0].sql).toBe('SELECT 2');
    });

    it('should do nothing if connection has no entries', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      store.clearForConnection('conn-999');
      expect(store.entries).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('should remove listener, reset flag, and clear entries', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      store.destroy();

      expect(mockRemoveListener).toHaveBeenCalledOnce();
      expect(store.entries).toEqual([]);
    });

    it('should allow re-init after destroy', () => {
      const store = useQueryLogStore();
      store.init();
      store.destroy();

      vi.clearAllMocks();

      store.init();
      expect(mockOnEntry).toHaveBeenCalledOnce();
    });
  });

  describe('MAX_ENTRIES overflow trimming', () => {
    it('should trim entries to last 100 when exceeding MAX_ENTRIES', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        callback({
          connectionId: 'conn-1',
          sql: `SELECT ${i}`,
          timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        });
      }

      expect(store.entries).toHaveLength(100);

      // Add one more to exceed MAX_ENTRIES
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT overflow',
        timestamp: '2025-01-01T00:01:00Z',
      });

      // Should be trimmed to 100
      expect(store.entries).toHaveLength(100);
      // First entry should no longer be SELECT 0
      expect(store.entries[0].sql).toBe('SELECT 1');
      // Last entry should be the overflow entry
      expect(store.entries[99].sql).toBe('SELECT overflow');
    });
  });

  describe('session ownership filtering', () => {
    it('should filter out entries from non-owned sessions', () => {
      registerSessions('conn-1');
      const store = useQueryLogStore();
      store.init();

      const callback = mockOnEntry.mock.calls[0][0] as (entry: QueryLogEntry) => void;

      // Entry from owned session
      callback({
        connectionId: 'conn-1',
        sql: 'SELECT 1',
        timestamp: '2025-01-01T00:00:00Z',
      });

      // Entry from non-owned session
      callback({
        connectionId: 'non-owned-session',
        sql: 'SELECT 2',
        timestamp: '2025-01-01T00:00:01Z',
      });

      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].sql).toBe('SELECT 1');
    });
  });
});
