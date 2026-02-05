import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLayoutStore } from '@/stores/layout';
import type { ColumnInfo, CellChange } from '@/types/query';

describe('Layout Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const store = useLayoutStore();

      expect(store.sidebarVisible).toBe(true);
      expect(store.sidebarWidth).toBe(260);
      expect(store.rightPanelVisible).toBe(false);
      expect(store.rightPanelWidth).toBe(320);
      expect(store.bottomPanelVisible).toBe(false);
      expect(store.bottomPanelHeight).toBe(200);
      expect(store.rightPanelRow).toBeNull();
      expect(store.rightPanelColumns).toEqual([]);
      expect(store.rightPanelRowIndex).toBeNull();
      expect(store.rightPanelPendingChanges).toEqual(new Map());
      expect(store.rightPanelOnUpdateCell).toBeNull();
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar visibility', () => {
      const store = useLayoutStore();
      expect(store.sidebarVisible).toBe(true);

      store.toggleSidebar();
      expect(store.sidebarVisible).toBe(false);

      store.toggleSidebar();
      expect(store.sidebarVisible).toBe(true);
    });
  });

  describe('toggleRightPanel', () => {
    it('should toggle right panel visibility', () => {
      const store = useLayoutStore();
      expect(store.rightPanelVisible).toBe(false);

      store.toggleRightPanel();
      expect(store.rightPanelVisible).toBe(true);

      store.toggleRightPanel();
      expect(store.rightPanelVisible).toBe(false);
    });
  });

  describe('toggleBottomPanel', () => {
    it('should toggle bottom panel visibility', () => {
      const store = useLayoutStore();
      expect(store.bottomPanelVisible).toBe(false);

      store.toggleBottomPanel();
      expect(store.bottomPanelVisible).toBe(true);

      store.toggleBottomPanel();
      expect(store.bottomPanelVisible).toBe(false);
    });
  });

  describe('clearRightPanel', () => {
    it('should reset all right panel data to defaults', () => {
      const store = useLayoutStore();

      // Set non-default values
      const columns: ColumnInfo[] = [
        { name: 'id', type: 'integer', nullable: false, primaryKey: true },
        { name: 'name', type: 'text', nullable: true },
      ];
      const onUpdateCell = vi.fn();
      const pendingChanges = new Map<string, CellChange>();
      pendingChanges.set('0-name', {
        rowIndex: 0,
        column: 'name',
        originalValue: 'old',
        newValue: 'new',
      });

      store.setRightPanelColumns(columns, onUpdateCell);
      store.setRightPanelRow({ id: 1, name: 'test' }, 0, pendingChanges);

      // Verify they were set
      expect(store.rightPanelRow).not.toBeNull();
      expect(store.rightPanelColumns).toHaveLength(2);
      expect(store.rightPanelRowIndex).toBe(0);
      expect(store.rightPanelPendingChanges.size).toBe(1);
      expect(store.rightPanelOnUpdateCell).toBe(onUpdateCell);

      // Clear
      store.clearRightPanel();

      expect(store.rightPanelRow).toBeNull();
      expect(store.rightPanelColumns).toEqual([]);
      expect(store.rightPanelRowIndex).toBeNull();
      expect(store.rightPanelPendingChanges).toEqual(new Map());
      expect(store.rightPanelOnUpdateCell).toBeNull();
    });
  });

  describe('setRightPanelRow', () => {
    it('should set row and rowIndex', () => {
      const store = useLayoutStore();
      const row = { id: 42, name: 'Alice' };

      store.setRightPanelRow(row, 5);

      expect(store.rightPanelRow).toEqual(row);
      expect(store.rightPanelRowIndex).toBe(5);
    });

    it('should set pendingChanges when provided', () => {
      const store = useLayoutStore();
      const row = { id: 1 };
      const pendingChanges = new Map<string, CellChange>();
      pendingChanges.set('0-id', {
        rowIndex: 0,
        column: 'id',
        originalValue: 1,
        newValue: 2,
      });

      store.setRightPanelRow(row, 0, pendingChanges);

      expect(store.rightPanelPendingChanges.size).toBe(1);
      expect(store.rightPanelPendingChanges.get('0-id')).toStrictEqual({
        rowIndex: 0,
        column: 'id',
        originalValue: 1,
        newValue: 2,
      });
    });

    it('should not overwrite pendingChanges when not provided', () => {
      const store = useLayoutStore();
      const existingChanges = new Map<string, CellChange>();
      existingChanges.set('0-id', {
        rowIndex: 0,
        column: 'id',
        originalValue: 1,
        newValue: 2,
      });
      store.rightPanelPendingChanges = existingChanges;

      store.setRightPanelRow({ id: 1 }, 0);

      expect(store.rightPanelPendingChanges.size).toBe(1);
      expect(store.rightPanelPendingChanges.get('0-id')).toStrictEqual({
        rowIndex: 0,
        column: 'id',
        originalValue: 1,
        newValue: 2,
      });
    });
  });

  describe('setRightPanelColumns', () => {
    it('should set columns and onUpdateCell callback', () => {
      const store = useLayoutStore();
      const columns: ColumnInfo[] = [
        { name: 'id', type: 'integer', nullable: false, primaryKey: true },
        { name: 'email', type: 'varchar', nullable: false },
      ];
      const onUpdateCell = vi.fn();

      store.setRightPanelColumns(columns, onUpdateCell);

      expect(store.rightPanelColumns).toEqual(columns);
      expect(store.rightPanelOnUpdateCell).toBe(onUpdateCell);
    });

    it('should replace previous columns and callback', () => {
      const store = useLayoutStore();
      const firstColumns: ColumnInfo[] = [
        { name: 'a', type: 'text', nullable: true },
      ];
      const secondColumns: ColumnInfo[] = [
        { name: 'b', type: 'integer', nullable: false },
        { name: 'c', type: 'text', nullable: true },
      ];
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      store.setRightPanelColumns(firstColumns, firstCallback);
      expect(store.rightPanelColumns).toEqual(firstColumns);

      store.setRightPanelColumns(secondColumns, secondCallback);
      expect(store.rightPanelColumns).toEqual(secondColumns);
      expect(store.rightPanelOnUpdateCell).toBe(secondCallback);
    });
  });

  describe('panel dimensions', () => {
    it('should allow updating sidebarWidth', () => {
      const store = useLayoutStore();
      store.sidebarWidth = 300;
      expect(store.sidebarWidth).toBe(300);
    });

    it('should allow updating rightPanelWidth', () => {
      const store = useLayoutStore();
      store.rightPanelWidth = 400;
      expect(store.rightPanelWidth).toBe(400);
    });

    it('should allow updating bottomPanelHeight', () => {
      const store = useLayoutStore();
      store.bottomPanelHeight = 350;
      expect(store.bottomPanelHeight).toBe(350);
    });
  });
});
