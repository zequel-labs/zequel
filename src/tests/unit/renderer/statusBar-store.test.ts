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
      expect(store.activeFiltersCount).toBe(0);
      expect(store.columns).toEqual([]);
      expect(store.showGridControls).toBe(false);
      expect(store.viewTabs).toEqual([]);
      expect(store.activeView).toBe('data');
    });

    it('should have correct default monitoring values', () => {
      const store = useStatusBarStore();

      expect(store.showMonitoringControls).toBe(false);
      expect(store.monitoringProcessCount).toBe(0);
      expect(store.monitoringAutoRefresh).toBe(false);
      expect(store.monitoringActiveConnections).toBeNull();
      expect(store.monitoringMaxConnections).toBeNull();
    });

    it('should have correct default ER diagram values', () => {
      const store = useStatusBarStore();

      expect(store.showERDiagramControls).toBe(false);
      expect(store.erDiagramTableCount).toBe(0);
      expect(store.erDiagramRelationshipCount).toBe(0);
    });

    it('should have correct default users values', () => {
      const store = useStatusBarStore();

      expect(store.showUsersControls).toBe(false);
      expect(store.usersCount).toBe(0);
    });

    it('should have correct default ownerTabId, structureChangesCount, and dataChangesCount', () => {
      const store = useStatusBarStore();

      expect(store.ownerTabId).toBeNull();
      expect(store.structureChangesCount).toBe(0);
      expect(store.dataChangesCount).toBe(0);
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

    it('should update monitoring state', () => {
      const store = useStatusBarStore();
      store.showMonitoringControls = true;
      store.monitoringProcessCount = 42;
      store.monitoringAutoRefresh = true;
      store.monitoringActiveConnections = '10';
      store.monitoringMaxConnections = '100';

      expect(store.showMonitoringControls).toBe(true);
      expect(store.monitoringProcessCount).toBe(42);
      expect(store.monitoringAutoRefresh).toBe(true);
      expect(store.monitoringActiveConnections).toBe('10');
      expect(store.monitoringMaxConnections).toBe('100');
    });

    it('should update ER diagram state', () => {
      const store = useStatusBarStore();
      store.showERDiagramControls = true;
      store.erDiagramTableCount = 15;
      store.erDiagramRelationshipCount = 8;

      expect(store.showERDiagramControls).toBe(true);
      expect(store.erDiagramTableCount).toBe(15);
      expect(store.erDiagramRelationshipCount).toBe(8);
    });

    it('should update users state', () => {
      const store = useStatusBarStore();
      store.showUsersControls = true;
      store.usersCount = 5;

      expect(store.showUsersControls).toBe(true);
      expect(store.usersCount).toBe(5);
    });

    it('should update ownerTabId', () => {
      const store = useStatusBarStore();
      store.ownerTabId = 'tab-123';
      expect(store.ownerTabId).toBe('tab-123');
    });

    it('should update structureChangesCount', () => {
      const store = useStatusBarStore();
      store.structureChangesCount = 3;
      expect(store.structureChangesCount).toBe(3);
    });

    it('should update dataChangesCount', () => {
      const store = useStatusBarStore();
      store.dataChangesCount = 7;
      expect(store.dataChangesCount).toBe(7);
    });
  });

  describe('registerCallbacks', () => {
    it('should register all callbacks', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();
      const onToggleColumn = vi.fn();
      const onShowAllColumns = vi.fn();
      const onApplySettings = vi.fn();
      const onViewChange = vi.fn();

      store.registerCallbacks({
        onPageChange,
        onToggleColumn,
        onShowAllColumns,
        onApplySettings,
        onViewChange,
      });

      store.pageChange(50);
      expect(onPageChange).toHaveBeenCalledWith(50);

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

    it('should clear ER diagram, monitoring, and users controls when registering grid callbacks', () => {
      const store = useStatusBarStore();
      store.showERDiagramControls = true;
      store.showMonitoringControls = true;
      store.showUsersControls = true;

      store.registerCallbacks({ onPageChange: vi.fn() });

      expect(store.showERDiagramControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should register onAddRow and onExportData callbacks', () => {
      const store = useStatusBarStore();
      const onAddRow = vi.fn();
      const onExportData = vi.fn();

      store.registerCallbacks({ onAddRow, onExportData });

      store.addRow();
      expect(onAddRow).toHaveBeenCalled();

      store.exportData();
      expect(onExportData).toHaveBeenCalled();
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();

      // Register first with a callback
      store.registerCallbacks({ onPageChange });

      // Re-register without it - should null it out
      store.registerCallbacks({});

      store.pageChange(10);
      expect(onPageChange).not.toHaveBeenCalled();
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

  describe('toggleColumn', () => {
    it('should invoke onToggleColumn callback with column id', () => {
      const store = useStatusBarStore();
      const onToggleColumn = vi.fn();
      store.registerCallbacks({ onToggleColumn });

      store.toggleColumn('col_id');
      expect(onToggleColumn).toHaveBeenCalledWith('col_id');
    });

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.toggleColumn('col1')).not.toThrow();
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

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.showAllColumns()).not.toThrow();
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

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.applySettings(50, 0)).not.toThrow();
    });
  });

  describe('exportData', () => {
    it('should invoke onExportData callback', () => {
      const store = useStatusBarStore();
      const onExportData = vi.fn();
      store.registerCallbacks({ onExportData });

      store.exportData();
      expect(onExportData).toHaveBeenCalled();
    });

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.exportData()).not.toThrow();
    });

    it('should be cleared after clear()', () => {
      const store = useStatusBarStore();
      const onExportData = vi.fn();
      store.registerCallbacks({ onExportData });

      store.clear();

      store.exportData();
      expect(onExportData).not.toHaveBeenCalled();
    });
  });

  describe('addRow', () => {
    it('should invoke onAddRow callback', () => {
      const store = useStatusBarStore();
      const onAddRow = vi.fn();
      store.registerCallbacks({ onAddRow });

      store.addRow();
      expect(onAddRow).toHaveBeenCalled();
    });

    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.addRow()).not.toThrow();
    });
  });

  describe('setStructureCallbacks', () => {
    it('should register onApply and onDiscard callbacks', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();
      const onDiscard = vi.fn();

      store.setStructureCallbacks({ onApply, onDiscard });

      store.applyStructureChanges();
      expect(onApply).toHaveBeenCalled();

      store.discardStructureChanges();
      expect(onDiscard).toHaveBeenCalled();
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();

      store.setStructureCallbacks({ onApply });
      store.setStructureCallbacks({});

      store.applyStructureChanges();
      expect(onApply).not.toHaveBeenCalled();
    });

    it('should allow partial registration with only onApply', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();

      store.setStructureCallbacks({ onApply });

      store.applyStructureChanges();
      expect(onApply).toHaveBeenCalled();

      // discardStructureChanges should not throw without callback
      expect(() => store.discardStructureChanges()).not.toThrow();
    });

    it('should allow partial registration with only onDiscard', () => {
      const store = useStatusBarStore();
      const onDiscard = vi.fn();

      store.setStructureCallbacks({ onDiscard });

      store.discardStructureChanges();
      expect(onDiscard).toHaveBeenCalled();

      // applyStructureChanges should not throw without callback
      expect(() => store.applyStructureChanges()).not.toThrow();
    });
  });

  describe('applyStructureChanges', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.applyStructureChanges()).not.toThrow();
    });
  });

  describe('discardStructureChanges', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.discardStructureChanges()).not.toThrow();
    });
  });

  describe('setDataCallbacks', () => {
    it('should register onApply and onDiscard callbacks', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();
      const onDiscard = vi.fn();

      store.setDataCallbacks({ onApply, onDiscard });

      store.applyDataChanges();
      expect(onApply).toHaveBeenCalled();

      store.discardDataChanges();
      expect(onDiscard).toHaveBeenCalled();
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();

      store.setDataCallbacks({ onApply });
      store.setDataCallbacks({});

      store.applyDataChanges();
      expect(onApply).not.toHaveBeenCalled();
    });

    it('should allow partial registration with only onApply', () => {
      const store = useStatusBarStore();
      const onApply = vi.fn();

      store.setDataCallbacks({ onApply });

      store.applyDataChanges();
      expect(onApply).toHaveBeenCalled();

      expect(() => store.discardDataChanges()).not.toThrow();
    });

    it('should allow partial registration with only onDiscard', () => {
      const store = useStatusBarStore();
      const onDiscard = vi.fn();

      store.setDataCallbacks({ onDiscard });

      store.discardDataChanges();
      expect(onDiscard).toHaveBeenCalled();

      expect(() => store.applyDataChanges()).not.toThrow();
    });
  });

  describe('applyDataChanges', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.applyDataChanges()).not.toThrow();
    });
  });

  describe('discardDataChanges', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.discardDataChanges()).not.toThrow();
    });
  });

  describe('registerMonitoringCallbacks', () => {
    it('should register onRefresh and onToggleAutoRefresh callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onToggleAutoRefresh = vi.fn();

      store.registerMonitoringCallbacks({ onRefresh, onToggleAutoRefresh });

      store.monitoringRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.monitoringToggleAutoRefresh();
      expect(onToggleAutoRefresh).toHaveBeenCalled();
    });

    it('should clear grid, ER diagram, and users controls when registering monitoring callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showERDiagramControls = true;
      store.showUsersControls = true;

      store.registerMonitoringCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerMonitoringCallbacks({ onRefresh });
      store.registerMonitoringCallbacks({});

      store.monitoringRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should allow partial registration with only onRefresh', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerMonitoringCallbacks({ onRefresh });

      store.monitoringRefresh();
      expect(onRefresh).toHaveBeenCalled();

      expect(() => store.monitoringToggleAutoRefresh()).not.toThrow();
    });

    it('should allow partial registration with only onToggleAutoRefresh', () => {
      const store = useStatusBarStore();
      const onToggleAutoRefresh = vi.fn();

      store.registerMonitoringCallbacks({ onToggleAutoRefresh });

      store.monitoringToggleAutoRefresh();
      expect(onToggleAutoRefresh).toHaveBeenCalled();

      expect(() => store.monitoringRefresh()).not.toThrow();
    });
  });

  describe('monitoringRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.monitoringRefresh()).not.toThrow();
    });
  });

  describe('monitoringToggleAutoRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.monitoringToggleAutoRefresh()).not.toThrow();
    });
  });

  describe('registerERDiagramCallbacks', () => {
    it('should register all ER diagram callbacks', () => {
      const store = useStatusBarStore();
      const onZoomIn = vi.fn();
      const onZoomOut = vi.fn();
      const onFitView = vi.fn();
      const onResetLayout = vi.fn();

      store.registerERDiagramCallbacks({ onZoomIn, onZoomOut, onFitView, onResetLayout });

      store.erZoomIn();
      expect(onZoomIn).toHaveBeenCalled();

      store.erZoomOut();
      expect(onZoomOut).toHaveBeenCalled();

      store.erFitView();
      expect(onFitView).toHaveBeenCalled();

      store.erResetLayout();
      expect(onResetLayout).toHaveBeenCalled();
    });

    it('should clear grid, monitoring, and users controls when registering ER diagram callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;
      store.showUsersControls = true;

      store.registerERDiagramCallbacks({ onZoomIn: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onZoomIn = vi.fn();

      store.registerERDiagramCallbacks({ onZoomIn });
      store.registerERDiagramCallbacks({});

      store.erZoomIn();
      expect(onZoomIn).not.toHaveBeenCalled();
    });

    it('should allow partial registration', () => {
      const store = useStatusBarStore();
      const onZoomIn = vi.fn();

      store.registerERDiagramCallbacks({ onZoomIn });

      store.erZoomIn();
      expect(onZoomIn).toHaveBeenCalled();

      // Other actions should not throw
      expect(() => store.erZoomOut()).not.toThrow();
      expect(() => store.erFitView()).not.toThrow();
      expect(() => store.erResetLayout()).not.toThrow();
    });
  });

  describe('erZoomIn', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.erZoomIn()).not.toThrow();
    });
  });

  describe('erZoomOut', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.erZoomOut()).not.toThrow();
    });
  });

  describe('erFitView', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.erFitView()).not.toThrow();
    });
  });

  describe('erResetLayout', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.erResetLayout()).not.toThrow();
    });
  });

  describe('registerUsersCallbacks', () => {
    it('should register onRefresh and onCreate callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCreate = vi.fn();

      store.registerUsersCallbacks({ onRefresh, onCreate });

      store.usersRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.usersCreate();
      expect(onCreate).toHaveBeenCalled();
    });

    it('should clear grid, ER diagram, and monitoring controls when registering users callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showERDiagramControls = true;
      store.showMonitoringControls = true;

      store.registerUsersCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerUsersCallbacks({ onRefresh });
      store.registerUsersCallbacks({});

      store.usersRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should allow partial registration with only onRefresh', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerUsersCallbacks({ onRefresh });

      store.usersRefresh();
      expect(onRefresh).toHaveBeenCalled();

      expect(() => store.usersCreate()).not.toThrow();
    });

    it('should allow partial registration with only onCreate', () => {
      const store = useStatusBarStore();
      const onCreate = vi.fn();

      store.registerUsersCallbacks({ onCreate });

      store.usersCreate();
      expect(onCreate).toHaveBeenCalled();

      expect(() => store.usersRefresh()).not.toThrow();
    });
  });

  describe('usersRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.usersRefresh()).not.toThrow();
    });
  });

  describe('usersCreate', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.usersCreate()).not.toThrow();
    });
  });

  describe('hasContent', () => {
    it('should return false when all controls are hidden and no view tabs', () => {
      const store = useStatusBarStore();
      expect(store.hasContent).toBe(false);
    });

    it('should return true when viewTabs has entries', () => {
      const store = useStatusBarStore();
      store.viewTabs = ['data', 'structure'];
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showGridControls is true', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when structureChangesCount is greater than 0', () => {
      const store = useStatusBarStore();
      store.structureChangesCount = 1;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when dataChangesCount is greater than 0', () => {
      const store = useStatusBarStore();
      store.dataChangesCount = 2;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showERDiagramControls is true', () => {
      const store = useStatusBarStore();
      store.showERDiagramControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showMonitoringControls is true', () => {
      const store = useStatusBarStore();
      store.showMonitoringControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showUsersControls is true', () => {
      const store = useStatusBarStore();
      store.showUsersControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when multiple conditions are true', () => {
      const store = useStatusBarStore();
      store.viewTabs = ['data'];
      store.showGridControls = true;
      store.showMonitoringControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return false after clearing all content flags', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.viewTabs = ['data'];
      store.structureChangesCount = 5;

      store.clear();

      expect(store.hasContent).toBe(false);
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

    it('should reset monitoring state', () => {
      const store = useStatusBarStore();
      store.showMonitoringControls = true;
      store.monitoringProcessCount = 10;
      store.monitoringAutoRefresh = true;
      store.monitoringActiveConnections = '5';
      store.monitoringMaxConnections = '50';

      store.clear();

      expect(store.showMonitoringControls).toBe(false);
      expect(store.monitoringProcessCount).toBe(0);
      expect(store.monitoringAutoRefresh).toBe(false);
      expect(store.monitoringActiveConnections).toBeNull();
      expect(store.monitoringMaxConnections).toBeNull();
    });

    it('should reset ER diagram state', () => {
      const store = useStatusBarStore();
      store.showERDiagramControls = true;
      store.erDiagramTableCount = 20;
      store.erDiagramRelationshipCount = 15;

      store.clear();

      expect(store.showERDiagramControls).toBe(false);
      expect(store.erDiagramTableCount).toBe(0);
      expect(store.erDiagramRelationshipCount).toBe(0);
    });

    it('should reset users state', () => {
      const store = useStatusBarStore();
      store.showUsersControls = true;
      store.usersCount = 8;

      store.clear();

      expect(store.showUsersControls).toBe(false);
      expect(store.usersCount).toBe(0);
    });

    it('should reset ownerTabId', () => {
      const store = useStatusBarStore();
      store.ownerTabId = 'tab-456';

      store.clear();

      expect(store.ownerTabId).toBeNull();
    });

    it('should reset structureChangesCount and dataChangesCount', () => {
      const store = useStatusBarStore();
      store.structureChangesCount = 3;
      store.dataChangesCount = 5;

      store.clear();

      expect(store.structureChangesCount).toBe(0);
      expect(store.dataChangesCount).toBe(0);
    });

    it('should clear all callback types', () => {
      const store = useStatusBarStore();
      const onPageChange = vi.fn();
      const onToggleColumn = vi.fn();
      const onShowAllColumns = vi.fn();
      const onApplySettings = vi.fn();
      const onViewChange = vi.fn();
      const onAddRow = vi.fn();
      const onExportData = vi.fn();
      const onStructureApply = vi.fn();
      const onStructureDiscard = vi.fn();
      const onDataApply = vi.fn();
      const onDataDiscard = vi.fn();

      store.registerCallbacks({
        onPageChange,
        onToggleColumn,
        onShowAllColumns,
        onApplySettings,
        onViewChange,
        onAddRow,
        onExportData,
      });
      store.setStructureCallbacks({ onApply: onStructureApply, onDiscard: onStructureDiscard });
      store.setDataCallbacks({ onApply: onDataApply, onDiscard: onDataDiscard });

      store.clear();

      store.pageChange(10);
      store.toggleColumn('col');
      store.showAllColumns();
      store.applySettings(25, 0);
      store.changeView('structure');
      store.addRow();
      store.exportData();
      store.applyStructureChanges();
      store.discardStructureChanges();
      store.applyDataChanges();
      store.discardDataChanges();

      expect(onPageChange).not.toHaveBeenCalled();
      expect(onToggleColumn).not.toHaveBeenCalled();
      expect(onShowAllColumns).not.toHaveBeenCalled();
      expect(onApplySettings).not.toHaveBeenCalled();
      expect(onViewChange).not.toHaveBeenCalled();
      expect(onAddRow).not.toHaveBeenCalled();
      expect(onExportData).not.toHaveBeenCalled();
      expect(onStructureApply).not.toHaveBeenCalled();
      expect(onStructureDiscard).not.toHaveBeenCalled();
      expect(onDataApply).not.toHaveBeenCalled();
      expect(onDataDiscard).not.toHaveBeenCalled();
    });

    it('should clear monitoring callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onToggleAutoRefresh = vi.fn();

      store.registerMonitoringCallbacks({ onRefresh, onToggleAutoRefresh });

      store.clear();

      store.monitoringRefresh();
      store.monitoringToggleAutoRefresh();

      expect(onRefresh).not.toHaveBeenCalled();
      expect(onToggleAutoRefresh).not.toHaveBeenCalled();
    });

    it('should clear ER diagram callbacks', () => {
      const store = useStatusBarStore();
      const onZoomIn = vi.fn();
      const onZoomOut = vi.fn();
      const onFitView = vi.fn();
      const onResetLayout = vi.fn();

      store.registerERDiagramCallbacks({ onZoomIn, onZoomOut, onFitView, onResetLayout });

      store.clear();

      store.erZoomIn();
      store.erZoomOut();
      store.erFitView();
      store.erResetLayout();

      expect(onZoomIn).not.toHaveBeenCalled();
      expect(onZoomOut).not.toHaveBeenCalled();
      expect(onFitView).not.toHaveBeenCalled();
      expect(onResetLayout).not.toHaveBeenCalled();
    });

    it('should clear users callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCreate = vi.fn();

      store.registerUsersCallbacks({ onRefresh, onCreate });

      store.clear();

      store.usersRefresh();
      store.usersCreate();

      expect(onRefresh).not.toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('should skip clearing when tabId does not match ownerTabId', () => {
      const store = useStatusBarStore();
      store.ownerTabId = 'tab-1';
      store.totalCount = 999;
      store.showGridControls = true;

      store.clear('tab-2');

      // State should NOT be cleared because tab-2 does not own the status bar
      expect(store.totalCount).toBe(999);
      expect(store.showGridControls).toBe(true);
      expect(store.ownerTabId).toBe('tab-1');
    });

    it('should clear when tabId matches ownerTabId', () => {
      const store = useStatusBarStore();
      store.ownerTabId = 'tab-1';
      store.totalCount = 999;
      store.showGridControls = true;

      store.clear('tab-1');

      expect(store.totalCount).toBe(0);
      expect(store.showGridControls).toBe(false);
      expect(store.ownerTabId).toBeNull();
    });

    it('should clear when no tabId is provided regardless of ownerTabId', () => {
      const store = useStatusBarStore();
      store.ownerTabId = 'tab-1';
      store.totalCount = 999;

      store.clear();

      expect(store.totalCount).toBe(0);
      expect(store.ownerTabId).toBeNull();
    });

    it('should clear when tabId is provided but ownerTabId is null', () => {
      const store = useStatusBarStore();
      store.totalCount = 999;

      // ownerTabId is null, tabId is provided => tabId is truthy but ownerTabId !== tabId => early return
      store.clear('tab-1');

      // Should NOT clear because null !== 'tab-1'
      expect(store.totalCount).toBe(999);
    });
  });

  describe('tab switching — dataChangesCount sync', () => {
    it('should NOT reset dataChangesCount when registerCallbacks is called', () => {
      const store = useStatusBarStore();
      store.dataChangesCount = 5;

      store.registerCallbacks({ onPageChange: vi.fn() });

      // clearAllControls inside registerCallbacks must NOT touch dataChangesCount
      expect(store.dataChangesCount).toBe(5);
    });

    it('should NOT reset structureChangesCount when registerCallbacks is called', () => {
      const store = useStatusBarStore();
      store.structureChangesCount = 3;

      store.registerCallbacks({ onPageChange: vi.fn() });

      expect(store.structureChangesCount).toBe(3);
    });

    it('should preserve data callbacks independently of grid callbacks', () => {
      const store = useStatusBarStore();
      const onDataApply = vi.fn();

      store.setDataCallbacks({ onApply: onDataApply });
      // Re-register grid callbacks (as happens on tab switch)
      store.registerCallbacks({ onPageChange: vi.fn() });

      // Data callbacks should still work — they are set separately
      store.applyDataChanges();
      expect(onDataApply).toHaveBeenCalled();
    });

    it('should simulate full tab switch: Tab A → Tab B → Tab A', () => {
      const store = useStatusBarStore();
      const tabAApply = vi.fn();
      const tabBApply = vi.fn();

      // --- Tab A is active, user edits 5 cells ---
      store.ownerTabId = 'tab-a';
      store.registerCallbacks({ onPageChange: vi.fn() });
      store.showGridControls = true;
      store.setDataCallbacks({ onApply: tabAApply });
      store.dataChangesCount = 5;

      expect(store.dataChangesCount).toBe(5);

      // --- User switches to Tab B (also a table with 3 edits) ---
      store.ownerTabId = 'tab-b';
      store.registerCallbacks({ onPageChange: vi.fn() });
      store.showGridControls = true;
      store.setDataCallbacks({ onApply: tabBApply });
      store.dataChangesCount = 3;

      expect(store.dataChangesCount).toBe(3);

      // --- User switches back to Tab A ---
      store.ownerTabId = 'tab-a';
      store.registerCallbacks({ onPageChange: vi.fn() });
      store.showGridControls = true;
      store.setDataCallbacks({ onApply: tabAApply });

      // dataChangesCount still holds Tab B's value (3) — the view must explicitly re-sync
      expect(store.dataChangesCount).toBe(3);

      // View explicitly syncs (this is the fix in syncStatusBar)
      store.dataChangesCount = 5;
      expect(store.dataChangesCount).toBe(5);

      // Callbacks should now point to Tab A
      store.applyDataChanges();
      expect(tabAApply).toHaveBeenCalledTimes(1);
      expect(tabBApply).not.toHaveBeenCalled();
    });

    it('should simulate tab switch where Tab B has no edits', () => {
      const store = useStatusBarStore();

      // Tab A has edits
      store.ownerTabId = 'tab-a';
      store.registerCallbacks({});
      store.showGridControls = true;
      store.dataChangesCount = 7;

      // Switch to Tab B (no edits)
      store.ownerTabId = 'tab-b';
      store.registerCallbacks({});
      store.showGridControls = true;
      store.dataChangesCount = 0;

      // Switch back to Tab A — without explicit re-sync, count is 0
      store.ownerTabId = 'tab-a';
      store.registerCallbacks({});
      store.showGridControls = true;
      // Before the fix: dataChangesCount = 0 (bug!)
      expect(store.dataChangesCount).toBe(0);

      // After explicit re-sync from view:
      store.dataChangesCount = 7;
      expect(store.dataChangesCount).toBe(7);
    });
  });

  describe('mutually exclusive controls', () => {
    it('should disable monitoring, ER, and users when registering grid callbacks', () => {
      const store = useStatusBarStore();
      store.showMonitoringControls = true;
      store.showERDiagramControls = true;
      store.showUsersControls = true;

      store.registerCallbacks({});

      expect(store.showMonitoringControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should disable grid, ER, and users when registering monitoring callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showERDiagramControls = true;
      store.showUsersControls = true;

      store.registerMonitoringCallbacks({});

      expect(store.showGridControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should disable grid, monitoring, and users when registering ER diagram callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;
      store.showUsersControls = true;

      store.registerERDiagramCallbacks({});

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
      expect(store.showUsersControls).toBe(false);
    });

    it('should disable grid, monitoring, and ER when registering users callbacks', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;
      store.showERDiagramControls = true;

      store.registerUsersCallbacks({});

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
    });
  });

  describe('registerTablePropertiesCallbacks', () => {
    it('should register onRefresh and onCopyDdl callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCopyDdl = vi.fn();

      store.registerTablePropertiesCallbacks({ onRefresh, onCopyDdl });

      store.tablePropertiesRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.tablePropertiesCopyDdl();
      expect(onCopyDdl).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerTablePropertiesCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerTablePropertiesCallbacks({ onRefresh });
      store.registerTablePropertiesCallbacks({});

      store.tablePropertiesRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('tablePropertiesRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.tablePropertiesRefresh()).not.toThrow();
    });
  });

  describe('tablePropertiesCopyDdl', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.tablePropertiesCopyDdl()).not.toThrow();
    });
  });

  describe('registerRoutineCallbacks', () => {
    it('should register onRefresh callback', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerRoutineCallbacks({ onRefresh });

      store.routineRefresh();
      expect(onRefresh).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerRoutineCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerRoutineCallbacks({ onRefresh });
      store.registerRoutineCallbacks({});

      store.routineRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('routineRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.routineRefresh()).not.toThrow();
    });
  });

  describe('registerTriggerCallbacks', () => {
    it('should register onRefresh callback', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerTriggerCallbacks({ onRefresh });

      store.triggerRefresh();
      expect(onRefresh).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showERDiagramControls = true;

      store.registerTriggerCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showERDiagramControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerTriggerCallbacks({ onRefresh });
      store.registerTriggerCallbacks({});

      store.triggerRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('triggerRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.triggerRefresh()).not.toThrow();
    });
  });

  describe('registerSequenceCallbacks', () => {
    it('should register onRefresh and onGetNextValue callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onGetNextValue = vi.fn();

      store.registerSequenceCallbacks({ onRefresh, onGetNextValue });

      store.sequenceRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.sequenceGetNextValue();
      expect(onGetNextValue).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerSequenceCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerSequenceCallbacks({ onRefresh });
      store.registerSequenceCallbacks({});

      store.sequenceRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('sequenceRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.sequenceRefresh()).not.toThrow();
    });
  });

  describe('sequenceGetNextValue', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.sequenceGetNextValue()).not.toThrow();
    });
  });

  describe('registerMaterializedViewCallbacks', () => {
    it('should register onRefresh and onRefreshData callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onRefreshData = vi.fn();

      store.registerMaterializedViewCallbacks({ onRefresh, onRefreshData });

      store.materializedViewRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.materializedViewRefreshData();
      expect(onRefreshData).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerMaterializedViewCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerMaterializedViewCallbacks({ onRefresh });
      store.registerMaterializedViewCallbacks({});

      store.materializedViewRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('materializedViewRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.materializedViewRefresh()).not.toThrow();
    });
  });

  describe('materializedViewRefreshData', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.materializedViewRefreshData()).not.toThrow();
    });
  });

  describe('registerExtensionsCallbacks', () => {
    it('should register onRefresh and onTabChange callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onTabChange = vi.fn();

      store.registerExtensionsCallbacks({ onRefresh, onTabChange });

      store.extensionsRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.extensionsTabChange('available');
      expect(onTabChange).toHaveBeenCalledWith('available');
      expect(store.extensionsActiveTab).toBe('available');
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerExtensionsCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerExtensionsCallbacks({ onRefresh });
      store.registerExtensionsCallbacks({});

      store.extensionsRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('extensionsRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.extensionsRefresh()).not.toThrow();
    });
  });

  describe('extensionsTabChange', () => {
    it('should update extensionsActiveTab and invoke callback', () => {
      const store = useStatusBarStore();
      const onTabChange = vi.fn();
      store.registerExtensionsCallbacks({ onTabChange });

      store.extensionsTabChange('available');

      expect(store.extensionsActiveTab).toBe('available');
      expect(onTabChange).toHaveBeenCalledWith('available');
    });

    it('should update extensionsActiveTab without callback', () => {
      const store = useStatusBarStore();
      store.extensionsTabChange('available');
      expect(store.extensionsActiveTab).toBe('available');
    });
  });

  describe('registerEventCallbacks', () => {
    it('should register onRefresh, onCopyDefinition, and onToggleStatus callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCopyDefinition = vi.fn();
      const onToggleStatus = vi.fn();

      store.registerEventCallbacks({ onRefresh, onCopyDefinition, onToggleStatus });

      store.eventRefresh();
      expect(onRefresh).toHaveBeenCalled();

      store.eventCopyDefinition();
      expect(onCopyDefinition).toHaveBeenCalled();

      store.eventToggleStatus();
      expect(onToggleStatus).toHaveBeenCalled();
    });

    it('should clear all other controls when registering', () => {
      const store = useStatusBarStore();
      store.showGridControls = true;
      store.showMonitoringControls = true;

      store.registerEventCallbacks({ onRefresh: vi.fn() });

      expect(store.showGridControls).toBe(false);
      expect(store.showMonitoringControls).toBe(false);
    });

    it('should set callbacks to null when not provided', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerEventCallbacks({ onRefresh });
      store.registerEventCallbacks({});

      store.eventRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('eventRefresh', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.eventRefresh()).not.toThrow();
    });
  });

  describe('eventCopyDefinition', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.eventCopyDefinition()).not.toThrow();
    });
  });

  describe('eventToggleStatus', () => {
    it('should not throw without callback', () => {
      const store = useStatusBarStore();
      expect(() => store.eventToggleStatus()).not.toThrow();
    });
  });

  describe('canAddRow', () => {
    it('should return true when onAddRow is registered', () => {
      const store = useStatusBarStore();
      store.registerCallbacks({ onAddRow: vi.fn() });
      expect(store.canAddRow).toBe(true);
    });

    it('should return false when onAddRow is not registered', () => {
      const store = useStatusBarStore();
      expect(store.canAddRow).toBe(false);
    });

    it('should return false after clear', () => {
      const store = useStatusBarStore();
      store.registerCallbacks({ onAddRow: vi.fn() });
      store.clear();
      expect(store.canAddRow).toBe(false);
    });
  });

  describe('hasContent additional controls', () => {
    it('should return true when showTablePropertiesControls is true', () => {
      const store = useStatusBarStore();
      store.showTablePropertiesControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showRoutineControls is true', () => {
      const store = useStatusBarStore();
      store.showRoutineControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showTriggerControls is true', () => {
      const store = useStatusBarStore();
      store.showTriggerControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showEventControls is true', () => {
      const store = useStatusBarStore();
      store.showEventControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showSequenceControls is true', () => {
      const store = useStatusBarStore();
      store.showSequenceControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showMaterializedViewControls is true', () => {
      const store = useStatusBarStore();
      store.showMaterializedViewControls = true;
      expect(store.hasContent).toBe(true);
    });

    it('should return true when showExtensionsControls is true', () => {
      const store = useStatusBarStore();
      store.showExtensionsControls = true;
      expect(store.hasContent).toBe(true);
    });
  });

  describe('clear resets additional controls', () => {
    it('should reset table properties state', () => {
      const store = useStatusBarStore();
      store.showTablePropertiesControls = true;
      store.tablePropertiesCount = 5;
      store.tablePropertiesHasDdl = true;

      store.clear();

      expect(store.showTablePropertiesControls).toBe(false);
      expect(store.tablePropertiesCount).toBe(0);
      expect(store.tablePropertiesHasDdl).toBe(false);
    });

    it('should reset routine state', () => {
      const store = useStatusBarStore();
      store.showRoutineControls = true;
      store.routineType = 'function';
      store.routineHasParams = true;

      store.clear();

      expect(store.showRoutineControls).toBe(false);
      expect(store.routineType).toBe('');
      expect(store.routineHasParams).toBe(false);
    });

    it('should reset trigger state', () => {
      const store = useStatusBarStore();
      store.showTriggerControls = true;
      store.triggerInfo = 'BEFORE INSERT';

      store.clear();

      expect(store.showTriggerControls).toBe(false);
      expect(store.triggerInfo).toBe('');
    });

    it('should reset event state and callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCopyDefinition = vi.fn();
      const onToggleStatus = vi.fn();

      store.registerEventCallbacks({ onRefresh, onCopyDefinition, onToggleStatus });
      store.showEventControls = true;
      store.eventStatus = 'ENABLED';

      store.clear();

      expect(store.showEventControls).toBe(false);
      expect(store.eventStatus).toBe('');

      store.eventRefresh();
      store.eventCopyDefinition();
      store.eventToggleStatus();
      expect(onRefresh).not.toHaveBeenCalled();
      expect(onCopyDefinition).not.toHaveBeenCalled();
      expect(onToggleStatus).not.toHaveBeenCalled();
    });

    it('should reset sequence state and callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onGetNextValue = vi.fn();

      store.registerSequenceCallbacks({ onRefresh, onGetNextValue });
      store.showSequenceControls = true;

      store.clear();

      expect(store.showSequenceControls).toBe(false);

      store.sequenceRefresh();
      store.sequenceGetNextValue();
      expect(onRefresh).not.toHaveBeenCalled();
      expect(onGetNextValue).not.toHaveBeenCalled();
    });

    it('should reset materialized view state and callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onRefreshData = vi.fn();

      store.registerMaterializedViewCallbacks({ onRefresh, onRefreshData });
      store.showMaterializedViewControls = true;

      store.clear();

      expect(store.showMaterializedViewControls).toBe(false);

      store.materializedViewRefresh();
      store.materializedViewRefreshData();
      expect(onRefresh).not.toHaveBeenCalled();
      expect(onRefreshData).not.toHaveBeenCalled();
    });

    it('should reset extensions state and callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onTabChange = vi.fn();

      store.registerExtensionsCallbacks({ onRefresh, onTabChange });
      store.showExtensionsControls = true;
      store.extensionsActiveTab = 'available';

      store.clear();

      expect(store.showExtensionsControls).toBe(false);
      expect(store.extensionsActiveTab).toBe('installed');

      store.extensionsRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should reset table properties callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();
      const onCopyDdl = vi.fn();

      store.registerTablePropertiesCallbacks({ onRefresh, onCopyDdl });

      store.clear();

      store.tablePropertiesRefresh();
      store.tablePropertiesCopyDdl();
      expect(onRefresh).not.toHaveBeenCalled();
      expect(onCopyDdl).not.toHaveBeenCalled();
    });

    it('should reset routine callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerRoutineCallbacks({ onRefresh });

      store.clear();

      store.routineRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should reset trigger callbacks', () => {
      const store = useStatusBarStore();
      const onRefresh = vi.fn();

      store.registerTriggerCallbacks({ onRefresh });

      store.clear();

      store.triggerRefresh();
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });
});
