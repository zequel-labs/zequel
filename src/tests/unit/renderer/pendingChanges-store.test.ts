import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePendingChangesStore } from '@/stores/pendingChanges';

describe('PendingChanges Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('saveChanges / getSavedChanges', () => {
    it('should save and retrieve pending changes', () => {
      const store = usePendingChangesStore();

      const data = {
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [['0-name', { rowIndex: 0, column: 'name', originalValue: 'Alice', newValue: 'Bob' }]] as [string, { rowIndex: number; column: string; originalValue: unknown; newValue: unknown }][],
        newRows: [{ name: 'Charlie' }],
        deleteRows: [2]
      };

      store.saveChanges(data);

      const result = store.getSavedChanges('conn-1', 'users', 'mydb');
      expect(result).toBeDefined();
      expect(result!.connectionId).toBe('conn-1');
      expect(result!.tableName).toBe('users');
      expect(result!.changes).toHaveLength(1);
      expect(result!.newRows).toHaveLength(1);
      expect(result!.deleteRows).toEqual([2]);
    });

    it('should return undefined for non-existent changes', () => {
      const store = usePendingChangesStore();
      expect(store.getSavedChanges('conn-1', 'users', 'mydb')).toBeUndefined();
    });

    it('should handle changes without database or schema', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        changes: [],
        newRows: [],
        deleteRows: []
      });

      expect(store.getSavedChanges('conn-1', 'users')).toBeDefined();
    });

    it('should differentiate by schema', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        schema: 'public',
        changes: [],
        newRows: [{ id: 1 }],
        deleteRows: []
      });

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        schema: 'private',
        changes: [],
        newRows: [{ id: 2 }],
        deleteRows: []
      });

      const pub = store.getSavedChanges('conn-1', 'users', 'mydb', 'public');
      const priv = store.getSavedChanges('conn-1', 'users', 'mydb', 'private');
      expect(pub!.newRows[0]).toEqual({ id: 1 });
      expect(priv!.newRows[0]).toEqual({ id: 2 });
    });
  });

  describe('clearSavedChanges', () => {
    it('should clear saved changes for a specific table', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [],
        newRows: [{ name: 'test' }],
        deleteRows: []
      });

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'orders',
        database: 'mydb',
        changes: [],
        newRows: [],
        deleteRows: [1]
      });

      store.clearSavedChanges('conn-1', 'users', 'mydb');

      expect(store.getSavedChanges('conn-1', 'users', 'mydb')).toBeUndefined();
      expect(store.getSavedChanges('conn-1', 'orders', 'mydb')).toBeDefined();
    });
  });

  describe('clearAllForConnection', () => {
    it('should clear all saved changes and live counts for a connection', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [],
        newRows: [],
        deleteRows: [1]
      });

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'orders',
        database: 'mydb',
        changes: [],
        newRows: [],
        deleteRows: [2]
      });

      store.saveChanges({
        connectionId: 'conn-2',
        tableName: 'products',
        database: 'otherdb',
        changes: [],
        newRows: [],
        deleteRows: [3]
      });

      store.updateLiveCount('conn-1', 'users', 5, 'mydb');

      store.clearAllForConnection('conn-1');

      expect(store.getSavedChanges('conn-1', 'users', 'mydb')).toBeUndefined();
      expect(store.getSavedChanges('conn-1', 'orders', 'mydb')).toBeUndefined();
      expect(store.getSavedChanges('conn-2', 'products', 'otherdb')).toBeDefined();
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(false);
    });
  });

  describe('liveChangeCounts', () => {
    it('should track live change counts', () => {
      const store = usePendingChangesStore();

      store.updateLiveCount('conn-1', 'users', 3, 'mydb');
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(true);

      store.updateLiveCount('conn-1', 'users', 0, 'mydb');
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(false);
    });

    it('should remove live count', () => {
      const store = usePendingChangesStore();

      store.updateLiveCount('conn-1', 'users', 5, 'mydb');
      store.removeLiveCount('conn-1', 'users', 'mydb');
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(false);
    });
  });

  describe('hasPendingChanges', () => {
    it('should return true for saved changes', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [],
        newRows: [{ name: 'test' }],
        deleteRows: []
      });

      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(true);
    });

    it('should return true for live changes', () => {
      const store = usePendingChangesStore();

      store.updateLiveCount('conn-1', 'users', 2, 'mydb');
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(true);
    });

    it('should return false when no changes exist', () => {
      const store = usePendingChangesStore();
      expect(store.hasPendingChanges('conn-1', 'users', 'mydb')).toBe(false);
    });
  });

  describe('connectionHasPendingChanges', () => {
    it('should return true if any table in connection has saved changes', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [],
        newRows: [{ name: 'test' }],
        deleteRows: []
      });

      expect(store.connectionHasPendingChanges('conn-1')).toBe(true);
      expect(store.connectionHasPendingChanges('conn-2')).toBe(false);
    });

    it('should return true if any table in connection has live changes', () => {
      const store = usePendingChangesStore();

      store.updateLiveCount('conn-1', 'orders', 1, 'mydb');

      expect(store.connectionHasPendingChanges('conn-1')).toBe(true);
      expect(store.connectionHasPendingChanges('conn-2')).toBe(false);
    });

    it('should return false after clearing all for connection', () => {
      const store = usePendingChangesStore();

      store.saveChanges({
        connectionId: 'conn-1',
        tableName: 'users',
        database: 'mydb',
        changes: [],
        newRows: [],
        deleteRows: [1]
      });
      store.updateLiveCount('conn-1', 'orders', 3, 'mydb');

      store.clearAllForConnection('conn-1');

      expect(store.connectionHasPendingChanges('conn-1')).toBe(false);
    });
  });
});
