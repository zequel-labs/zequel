import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStatusBarStore } from '@/stores/statusBar';

describe('StatusBar Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const store = useStatusBarStore();

      expect(store.totalCount).toBe(0);
      expect(store.offset).toBe(0);
      expect(store.limit).toBe(100);
      expect(store.isLoading).toBe(false);
      expect(store.showFilters).toBe(false);
      expect(store.activeFiltersCount).toBe(0);
      expect(store.columns).toEqual([]);
      expect(store.showGridControls).toBe(false);
      expect(store.viewTabs).toEqual([]);
      expect(store.activeView).toBe('data');
    });
  });

  describe('state mutations', () => {
    it('should update totalCount', () => {
      const store = useStatusBarStore();
      store.totalCount = 500;
      expect(store.totalCount).toBe(500);
    });

    it('should update offset', () => {
      const store = useStatusBarStore();
      store.offset = 100;
      expect(store.offset).toBe(100);
    });

    it('should update limit', () => {
      const store = useStatusBarStore();
      store.limit = 50;
      expect(store.limit).toBe(50);
    });

    it('should update isLoading', () => {
      const store = useStatusBarStore();
      store.isLoading = true;
      expect(store.isLoading).toBe(true);
    });

    it('should update showFilters', () => {
      const store = useStatusBarStore();
      store.showFilters = true;
      expect(store.showFilters).toBe(true);
    });

    it('should update activeFiltersCount', () => {
      const store = useStatusBarStore();
      store.activeFiltersCount = 3;
      expect(store.activeFiltersCount).toBe(3);
    });

    it('should update columns', () => {
      const store = useStatusBarStore();
      store.columns = [
        { id: 'col1', name: 'Column 1', visible: true },
        { id: 'col2', name: 'Column 2', visible: false },
      ];
      expect(store.columns).toHaveLength(2);
      expect(store.columns[0].name).toBe('Column 1');
    });

    it('should update showGridControls', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      expect(store.showGridControls).toBe(true);
    });

    it('should update viewTabs', () => {
      const store = useStatusBarStore();
      store.viewTabs = ['data', 'structure'];
      expect(store.viewTabs).toEqual(['data', 'structure']);
    });

    it('should update activeView', () => {
      const store = useStatusBarStore();
      store.activeView = 'structure';
      expect(store.activeView).toBe('structure');
    });
  });

  describe('registerCallbacks', () => {
    it('should register all callbacks', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();
      const onToggleFilters = vi.fn();
      const onToggleColumn = vi.fn();
      const onShowAllColumns = vi.fn();
      const onApplySettings = vi.fn();
      const onViewChange = vi.fn();

      store.registerCallbacks({
        onPageChange,
        onToggleFilters,
        onToggleColumn,
        onShowAllColumns,
        onApplySettings,
        onViewChange,
      });

      store.pageChange(50);
      expect(onPageChange).toHaveBeenCalledWith(50);

      store.toggleFilters();
      expect(onToggleFilters).toHaveBeenCalled();

      store.toggleColumn('col1');
      expect(onToggleColumn).toHaveBeenCalledWith('col1');

      store.showAllColumns();
      expect(onShowAllColumns).toHaveBeenCalled();

      store.applySettings(25, 100);
      expect(onApplySettings).toHaveBeenCalledWith(25, 100);

      store.changeView('structure');
      expect(onViewChange).toHaveBeenCalledWith('structure');
    });

    it('should allow partial callback registration', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();

      store.registerCallbacks({ onPageChange });

      store.pageChange(10);
      expect(onPageChange).toHaveBeenCalledWith(10);

      // Other actions should not throw even without callbacks
      store.toggleFilters();
      store.toggleColumn('col1');
      store.showAllColumns();
      store.applySettings(50, 0);
    });

    it('should replace previously registered callbacks', () => {
      const store = useStatusBarStore();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      store.registerCallbacks({ onPageChange: firstCallback });
      store.registerCallbacks({ onPageChange: secondCallback });

      store.pageChange(10);
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith(10);
    });
  });

  describe('changeView', () => {
    it('should update activeView and call onViewChange callback', () => {
      const store = useStatusBarStore();
      const onViewChange = vi.fn();
      store.registerCallbacks({ onViewChange });

      store.changeView('structure');

      expect(store.activeView).toBe('structure');
      expect(onViewChange).toHaveBeenCalledWith('structure');
    });

    it('should update activeView without callback', () => {
      const store = useStatusBarStore();
      store.changeView('structure');
      expect(store.activeView).toBe('structure');
    });
  });

  describe('pageChange', () => {
    it('should invoke onPageChange callback with offset', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();
      store.registerCallbacks({ onPageChange });

      store.pageChange(200);
      expect(onPageChange).toHaveBeenCalledWith(200);
    });

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.pageChange(100)).not.toThrow();
    });
  });

  describe('toggleFilters', () => {
    it('should invoke onToggleFilters callback', () => {
      const store = useStatusBarStore();
      const onToggleFilters = vi.fn();
      store.registerCallbacks({ onToggleFilters });

      store.toggleFilters();
      expect(onToggleFilters).toHaveBeenCalled();
    });
  });

  describe('toggleColumn', () => {
    it('should invoke onToggleColumn callback with column id', () => {
      const store = useStatusBarStore();
      const onToggleColumn = vi.fn();
      store.registerCallbacks({ onToggleColumn });

      store.toggleColumn('col_id');
      expect(onToggleColumn).toHaveBeenCalledWith('col_id');
    });
  });

  describe('showAllColumns', () => {
    it('should invoke onShowAllColumns callback', () => {
      const store = useStatusBarStore();
      const onShowAllColumns = vi.fn();
      store.registerCallbacks({ onShowAllColumns });

      store.showAllColumns();
      expect(onShowAllColumns).toHaveBeenCalled();
    });
  });

  describe('applySettings', () => {
    it('should invoke onApplySettings with limit and offset', () => {
      const store = useStatusBarStore();
      const onApplySettings = vi.fn();
      store.registerCallbacks({ onApplySettings });

      store.applySettings(50, 200);
      expect(onApplySettings).toHaveBeenCalledWith(50, 200);
    });
  });

  describe('clear', () => {
    it('should reset all state to defaults', () => {
      const store = useStatusBarStore();

      // Set non-default values
      store.totalCount = 500;
      store.offset = 100;
      store.limit = 50;
      store.isLoading = true;
      store.showFilters = true;
      store.activeFiltersCount = 3;
      store.columns = [{ id: 'col1', name: 'Col', visible: true }];
      store.showGridControls = true;
      store.viewTabs = ['data', 'structure'];
      store.activeView = 'structure';

      store.clear();

      expect(store.totalCount).toBe(0);
      expect(store.offset).toBe(0);
      expect(store.limit).toBe(100);
      expect(store.isLoading).toBe(false);
      expect(store.showFilters).toBe(false);
      expect(store.activeFiltersCount).toBe(0);
      expect(store.columns).toEqual([]);
      expect(store.showGridControls).toBe(false);
      expect(store.viewTabs).toEqual([]);
      expect(store.activeView).toBe('data');
    });

    it('should clear registered callbacks', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();
      store.registerCallbacks({ onPageChange });

      store.clear();

      store.pageChange(100);
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});
