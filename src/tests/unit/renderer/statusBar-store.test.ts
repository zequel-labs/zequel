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
});
