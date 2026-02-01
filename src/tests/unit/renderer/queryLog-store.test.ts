import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQueryLogStore } from '@/stores/queryLog';
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

    it('should push entries when listener fires', () => {
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
  });

  describe('clear', () => {
    it('should clear all entries', () => {
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
});
