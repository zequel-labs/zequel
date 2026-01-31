import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { TabType, RoutineType } from '@/types/table';

// Mock window.api.tabs
const mockTabsSave = vi.fn();
const mockTabsLoad = vi.fn();
const mockTabsDelete = vi.fn();

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    tabs: {
      save: mockTabsSave,
      load: mockTabsLoad,
      delete: mockTabsDelete,
    },
  },
});

// Mock generateId so we can predict tab IDs
let idCounter = 0;
vi.mock('@/lib/utils', () => ({
  generateId: () => `tab-${++idCounter}`,
}));

import { useTabsStore } from '@/stores/tabs';
import type { Tab, QueryResult } from '@/stores/tabs';

const mockQueryResult: QueryResult = {
  columns: [{ name: 'id', type: 'integer', nullable: false }],
  rows: [{ id: 1 }],
  rowCount: 1,
  executionTime: 42,
};

describe('Tabs Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    idCounter = 0;
  });

  describe('initial state', () => {
    it('should start with empty tabs', () => {
      const store = useTabsStore();
      expect(store.tabs).toEqual([]);
    });

    it('should start with null activeTabId', () => {
      const store = useTabsStore();
      expect(store.activeTabId).toBeNull();
    });

    it('should have null activeTab', () => {
      const store = useTabsStore();
      expect(store.activeTab).toBeNull();
    });
  });

  describe('computed: filtered tab lists', () => {
    it('should filter queryTabs', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.createTableTab('conn-1', 'users');

      expect(store.queryTabs).toHaveLength(1);
      expect(store.queryTabs[0].data.type).toBe(TabType.Query);
    });

    it('should filter tableTabs', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      store.createQueryTab('conn-1');

      expect(store.tableTabs).toHaveLength(1);
      expect(store.tableTabs[0].data.type).toBe(TabType.Table);
    });

    it('should filter viewTabs', () => {
      const store = useTabsStore();
      store.createViewTab('conn-1', 'user_view');
      store.createQueryTab('conn-1');

      expect(store.viewTabs).toHaveLength(1);
    });

    it('should filter erDiagramTabs', () => {
      const store = useTabsStore();
      store.createERDiagramTab('conn-1');
      store.createQueryTab('conn-1');

      expect(store.erDiagramTabs).toHaveLength(1);
    });

    it('should filter routineTabs', () => {
      const store = useTabsStore();
      store.createRoutineTab('conn-1', 'my_func', RoutineType.Function);
      store.createQueryTab('conn-1');

      expect(store.routineTabs).toHaveLength(1);
    });

    it('should filter usersTabs', () => {
      const store = useTabsStore();
      store.createUsersTab('conn-1');
      store.createQueryTab('conn-1');

      expect(store.usersTabs).toHaveLength(1);
    });

    it('should filter monitoringTabs', () => {
      const store = useTabsStore();
      store.createMonitoringTab('conn-1');
      store.createQueryTab('conn-1');

      expect(store.monitoringTabs).toHaveLength(1);
    });

    it('should filter triggerTabs', () => {
      const store = useTabsStore();
      store.createTriggerTab('conn-1', 'my_trigger', 'users');
      store.createQueryTab('conn-1');

      expect(store.triggerTabs).toHaveLength(1);
    });

    it('should filter eventTabs', () => {
      const store = useTabsStore();
      store.createEventTab('conn-1', 'my_event');
      store.createQueryTab('conn-1');

      expect(store.eventTabs).toHaveLength(1);
    });
  });

  describe('computed: hasUnsavedChanges', () => {
    it('should return false when no query tabs are dirty', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      expect(store.hasUnsavedChanges).toBe(false);
    });

    it('should return true when a query tab is dirty', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      store.setTabSql(tab.id, 'SELECT 1');
      expect(store.hasUnsavedChanges).toBe(true);
    });

    it('should return false for non-query tab changes', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      expect(store.hasUnsavedChanges).toBe(false);
    });
  });

  describe('createQueryTab', () => {
    it('should create a query tab with defaults', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      expect(tab.data.type).toBe(TabType.Query);
      expect(tab.data.connectionId).toBe('conn-1');
      if (tab.data.type === TabType.Query) {
        expect(tab.data.sql).toBe('');
        expect(tab.data.isExecuting).toBe(false);
        expect(tab.data.isDirty).toBe(false);
      }
      expect(tab.title).toBe('Query 1');
      expect(store.activeTabId).toBe(tab.id);
    });

    it('should create with custom SQL', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT * FROM users');

      if (tab.data.type === TabType.Query) {
        expect(tab.data.sql).toBe('SELECT * FROM users');
      }
    });

    it('should create with custom title', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', '', 'My Query');
      expect(tab.title).toBe('My Query');
    });

    it('should increment query count in title', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      expect(tab1.title).toBe('Query 1');
      expect(tab2.title).toBe('Query 2');
    });

    it('should allow multiple query tabs (no duplicate detection)', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1', 'SELECT 1');
      store.createQueryTab('conn-1', 'SELECT 1');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createTableTab', () => {
    it('should create a table tab', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users', 'mydb', 'public');

      expect(tab.data.type).toBe(TabType.Table);
      expect(tab.title).toBe('users');
      if (tab.data.type === TabType.Table) {
        expect(tab.data.tableName).toBe('users');
        expect(tab.data.database).toBe('mydb');
        expect(tab.data.schema).toBe('public');
        expect(tab.data.activeView).toBe('data');
      }
      expect(store.activeTabId).toBe(tab.id);
    });

    it('should reuse existing table tab (duplicate detection)', () => {
      const store = useTabsStore();
      const tab1 = store.createTableTab('conn-1', 'users');
      const tab2 = store.createTableTab('conn-1', 'users');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should not reuse tab for different table', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      store.createTableTab('conn-1', 'posts');

      expect(store.tabs).toHaveLength(2);
    });

    it('should not reuse tab for different connection', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      store.createTableTab('conn-2', 'users');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createViewTab', () => {
    it('should create a view tab', () => {
      const store = useTabsStore();
      const tab = store.createViewTab('conn-1', 'user_view', 'mydb', 'public');

      expect(tab.data.type).toBe(TabType.View);
      expect(tab.title).toBe('user_view');
      if (tab.data.type === TabType.View) {
        expect(tab.data.viewName).toBe('user_view');
        expect(tab.data.activeView).toBe('data');
      }
    });

    it('should reuse existing view tab', () => {
      const store = useTabsStore();
      const tab1 = store.createViewTab('conn-1', 'user_view');
      const tab2 = store.createViewTab('conn-1', 'user_view');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createERDiagramTab', () => {
    it('should create an ER diagram tab', () => {
      const store = useTabsStore();
      const tab = store.createERDiagramTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.ERDiagram);
      expect(tab.title).toBe('ER Diagram');
      if (tab.data.type === TabType.ERDiagram) {
        expect(tab.data.database).toBe('mydb');
      }
    });

    it('should reuse existing ER diagram tab per connection', () => {
      const store = useTabsStore();
      const tab1 = store.createERDiagramTab('conn-1');
      const tab2 = store.createERDiagramTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createRoutineTab', () => {
    it('should create a routine tab for function', () => {
      const store = useTabsStore();
      const tab = store.createRoutineTab('conn-1', 'my_func', RoutineType.Function, 'mydb', 'public');

      expect(tab.data.type).toBe(TabType.Routine);
      expect(tab.title).toBe('my_func (FN)');
      if (tab.data.type === TabType.Routine) {
        expect(tab.data.routineName).toBe('my_func');
        expect(tab.data.routineType).toBe(RoutineType.Function);
      }
    });

    it('should create a routine tab for procedure', () => {
      const store = useTabsStore();
      const tab = store.createRoutineTab('conn-1', 'my_proc', RoutineType.Procedure);

      expect(tab.title).toBe('my_proc (SP)');
      if (tab.data.type === TabType.Routine) {
        expect(tab.data.routineType).toBe(RoutineType.Procedure);
      }
    });

    it('should reuse existing routine tab by name and type', () => {
      const store = useTabsStore();
      const tab1 = store.createRoutineTab('conn-1', 'my_func', RoutineType.Function);
      const tab2 = store.createRoutineTab('conn-1', 'my_func', RoutineType.Function);

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should create separate tabs for function and procedure with same name', () => {
      const store = useTabsStore();
      store.createRoutineTab('conn-1', 'my_routine', RoutineType.Function);
      store.createRoutineTab('conn-1', 'my_routine', RoutineType.Procedure);

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createUsersTab', () => {
    it('should create a users tab', () => {
      const store = useTabsStore();
      const tab = store.createUsersTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.Users);
      expect(tab.title).toBe('Users');
    });

    it('should reuse existing users tab per connection', () => {
      const store = useTabsStore();
      const tab1 = store.createUsersTab('conn-1');
      const tab2 = store.createUsersTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createMonitoringTab', () => {
    it('should create a monitoring tab', () => {
      const store = useTabsStore();
      const tab = store.createMonitoringTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.Monitoring);
      expect(tab.title).toBe('Process Monitor');
    });

    it('should reuse existing monitoring tab per connection', () => {
      const store = useTabsStore();
      const tab1 = store.createMonitoringTab('conn-1');
      const tab2 = store.createMonitoringTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createSequenceTab', () => {
    it('should create a sequence tab', () => {
      const store = useTabsStore();
      const tab = store.createSequenceTab('conn-1', 'users_id_seq', 'public', 'mydb');

      expect(tab.data.type).toBe(TabType.Sequence);
      expect(tab.title).toBe('users_id_seq (SEQ)');
      if (tab.data.type === TabType.Sequence) {
        expect(tab.data.sequenceName).toBe('users_id_seq');
        expect(tab.data.schema).toBe('public');
      }
    });

    it('should reuse existing sequence tab by name and schema', () => {
      const store = useTabsStore();
      const tab1 = store.createSequenceTab('conn-1', 'users_id_seq', 'public');
      const tab2 = store.createSequenceTab('conn-1', 'users_id_seq', 'public');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should create separate tabs for different schemas', () => {
      const store = useTabsStore();
      store.createSequenceTab('conn-1', 'users_id_seq', 'public');
      store.createSequenceTab('conn-1', 'users_id_seq', 'other');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createMaterializedViewTab', () => {
    it('should create a materialized view tab', () => {
      const store = useTabsStore();
      const tab = store.createMaterializedViewTab('conn-1', 'mv_users', 'public', 'mydb');

      expect(tab.data.type).toBe(TabType.MaterializedView);
      expect(tab.title).toBe('mv_users (MV)');
      if (tab.data.type === TabType.MaterializedView) {
        expect(tab.data.activeView).toBe('data');
      }
    });

    it('should reuse existing materialized view tab', () => {
      const store = useTabsStore();
      const tab1 = store.createMaterializedViewTab('conn-1', 'mv_users', 'public');
      const tab2 = store.createMaterializedViewTab('conn-1', 'mv_users', 'public');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createExtensionsTab', () => {
    it('should create an extensions tab', () => {
      const store = useTabsStore();
      const tab = store.createExtensionsTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.Extensions);
      expect(tab.title).toBe('Extensions');
    });

    it('should reuse existing extensions tab per connection', () => {
      const store = useTabsStore();
      const tab1 = store.createExtensionsTab('conn-1');
      const tab2 = store.createExtensionsTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createEnumsTab', () => {
    it('should create an enums tab', () => {
      const store = useTabsStore();
      const tab = store.createEnumsTab('conn-1', 'public', 'mydb');

      expect(tab.data.type).toBe(TabType.Enums);
      expect(tab.title).toBe('Enums');
    });

    it('should reuse existing enums tab per connection', () => {
      const store = useTabsStore();
      const tab1 = store.createEnumsTab('conn-1');
      const tab2 = store.createEnumsTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createTriggerTab', () => {
    it('should create a trigger tab', () => {
      const store = useTabsStore();
      const tab = store.createTriggerTab('conn-1', 'my_trigger', 'users', 'mydb', 'public');

      expect(tab.data.type).toBe(TabType.Trigger);
      expect(tab.title).toBe('my_trigger (Trigger)');
      if (tab.data.type === TabType.Trigger) {
        expect(tab.data.triggerName).toBe('my_trigger');
        expect(tab.data.tableName).toBe('users');
      }
    });

    it('should reuse existing trigger tab by name and table', () => {
      const store = useTabsStore();
      const tab1 = store.createTriggerTab('conn-1', 'my_trigger', 'users');
      const tab2 = store.createTriggerTab('conn-1', 'my_trigger', 'users');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('createEventTab', () => {
    it('should create an event tab', () => {
      const store = useTabsStore();
      const tab = store.createEventTab('conn-1', 'daily_cleanup', 'mydb');

      expect(tab.data.type).toBe(TabType.Event);
      expect(tab.title).toBe('daily_cleanup (Event)');
      if (tab.data.type === TabType.Event) {
        expect(tab.data.eventName).toBe('daily_cleanup');
      }
    });

    it('should reuse existing event tab', () => {
      const store = useTabsStore();
      const tab1 = store.createEventTab('conn-1', 'daily_cleanup');
      const tab2 = store.createEventTab('conn-1', 'daily_cleanup');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('closeTab', () => {
    it('should remove a tab', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      store.closeTab(tab.id);

      expect(store.tabs).toHaveLength(0);
    });

    it('should activate previous tab when closing active tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      // tab3 is active
      store.closeTab(tab3.id);
      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should activate first tab when closing first active tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      store.setActiveTab(tab1.id);
      store.closeTab(tab1.id);
      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should set activeTabId to null when closing last tab', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      store.closeTab(tab.id);

      expect(store.activeTabId).toBeNull();
    });

    it('should not change activeTab when closing non-active tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      // tab2 is active after creation
      store.closeTab(tab1.id);
      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should do nothing for non-existent tab id', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');

      store.closeTab('nonexistent');
      expect(store.tabs).toHaveLength(1);
    });
  });

  describe('closeAllTabs', () => {
    it('should remove all tabs', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.createTableTab('conn-1', 'users');
      store.createQueryTab('conn-2');

      store.closeAllTabs();

      expect(store.tabs).toEqual([]);
      expect(store.activeTabId).toBeNull();
    });
  });

  describe('closeOtherTabs', () => {
    it('should keep only the specified tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');

      store.closeOtherTabs(tab1.id);

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe(tab1.id);
      expect(store.activeTabId).toBe(tab1.id);
    });
  });

  describe('closeTabsForConnection', () => {
    it('should close all tabs for a specific connection', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.createTableTab('conn-1', 'users');
      const otherTab = store.createQueryTab('conn-2');

      store.closeTabsForConnection('conn-1');

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].data.connectionId).toBe('conn-2');
    });

    it('should switch active tab if current is removed', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      store.setActiveTab(tab1.id);
      store.closeTabsForConnection('conn-1');

      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should set activeTabId to null if all tabs are removed', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');

      store.closeTabsForConnection('conn-1');

      expect(store.activeTabId).toBeNull();
    });
  });

  describe('setActiveTab', () => {
    it('should set the active tab id', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      store.setActiveTab(tab1.id);
      expect(store.activeTabId).toBe(tab1.id);
    });

    it('should update activeTab computed property', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      store.setActiveTab(tab1.id);
      expect(store.activeTab?.id).toBe(tab1.id);
    });
  });

  describe('updateTab', () => {
    it('should update tab properties', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.updateTab(tab.id, { title: 'Updated Title' });
      expect(store.tabs[0].title).toBe('Updated Title');
    });

    it('should do nothing for non-existent tab', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.updateTab('nonexistent', { title: 'X' });
      expect(store.tabs[0].title).not.toBe('X');
    });
  });

  describe('updateTabData', () => {
    it('should update tab data properties', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.updateTabData(tab.id, { sql: 'SELECT 1' } as Partial<import('@/stores/tabs').TabData>);
      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.sql).toBe('SELECT 1');
      }
    });
  });

  describe('setTabSql', () => {
    it('should update SQL and mark as dirty', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabSql(tab.id, 'SELECT * FROM users');

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.sql).toBe('SELECT * FROM users');
        expect(store.tabs[0].data.isDirty).toBe(true);
      }
    });

    it('should not affect non-query tabs', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');

      store.setTabSql(tab.id, 'SELECT 1');
      // Table tab should not have sql property
      expect(store.tabs[0].data.type).toBe(TabType.Table);
    });
  });

  describe('setTabResult', () => {
    it('should set query result', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabResult(tab.id, mockQueryResult);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.result).toEqual(mockQueryResult);
      }
    });

    it('should clear query result with undefined', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabResult(tab.id, mockQueryResult);
      store.setTabResult(tab.id, undefined);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.result).toBeUndefined();
      }
    });
  });

  describe('setTabExecuting', () => {
    it('should set executing state', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabExecuting(tab.id, true);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.isExecuting).toBe(true);
      }
    });

    it('should clear executing state', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabExecuting(tab.id, true);
      store.setTabExecuting(tab.id, false);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.isExecuting).toBe(false);
      }
    });
  });

  describe('setTableView', () => {
    it('should set active view for table tab', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');

      store.setTableView(tab.id, 'structure');

      if (store.tabs[0].data.type === TabType.Table) {
        expect(store.tabs[0].data.activeView).toBe('structure');
      }
    });

    it('should not affect non-table tabs', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      store.setTableView(tab.id, 'structure');
      // Should not throw or add activeView
      expect(store.tabs[0].data.type).toBe(TabType.Query);
    });
  });

  describe('setTabResults', () => {
    it('should set multiple results and set activeResultIndex to 0', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      const results = [mockQueryResult, { ...mockQueryResult, rowCount: 2 }];
      store.setTabResults(tab.id, results);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.results).toEqual(results);
        expect(store.tabs[0].data.activeResultIndex).toBe(0);
        expect(store.tabs[0].data.result).toEqual(results[0]);
      }
    });

    it('should handle empty results array', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabResults(tab.id, []);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.results).toEqual([]);
        expect(store.tabs[0].data.result).toBeUndefined();
      }
    });
  });

  describe('setTabActiveResultIndex', () => {
    it('should switch active result', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      const result2 = { ...mockQueryResult, rowCount: 5 };
      const results = [mockQueryResult, result2];
      store.setTabResults(tab.id, results);
      store.setTabActiveResultIndex(tab.id, 1);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.activeResultIndex).toBe(1);
        expect(store.tabs[0].data.result).toEqual(result2);
      }
    });
  });

  describe('setTabQueryPlan', () => {
    it('should set query plan', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      const plan = { rows: [{ id: 1 }], columns: ['id'], planText: 'Seq Scan' };
      store.setTabQueryPlan(tab.id, plan);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.queryPlan).toEqual(plan);
      }
    });

    it('should clear query plan', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabQueryPlan(tab.id, { rows: [], columns: [] });
      store.setTabQueryPlan(tab.id, undefined);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.queryPlan).toBeUndefined();
      }
    });
  });

  describe('setTabShowPlan', () => {
    it('should set showPlan flag', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabShowPlan(tab.id, true);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.showPlan).toBe(true);
      }
    });

    it('should clear showPlan flag', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabShowPlan(tab.id, true);
      store.setTabShowPlan(tab.id, false);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.showPlan).toBe(false);
      }
    });
  });

  describe('reorderTabs', () => {
    it('should reorder tabs', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createTableTab('conn-1', 'users');
      const tab3 = store.createQueryTab('conn-1');

      store.reorderTabs(0, 2);

      expect(store.tabs[0].id).toBe(tab2.id);
      expect(store.tabs[1].id).toBe(tab3.id);
      expect(store.tabs[2].id).toBe(tab1.id);
    });

    it('should not reorder with same indices', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');

      store.reorderTabs(0, 0);

      expect(store.tabs[0].id).toBe(tab1.id);
      expect(store.tabs[1].id).toBe(tab2.id);
    });

    it('should not reorder with out-of-bounds from index', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');

      store.reorderTabs(-1, 0);
      expect(store.tabs[0].id).toBe(tab1.id);

      store.reorderTabs(5, 0);
      expect(store.tabs[0].id).toBe(tab1.id);
    });

    it('should not reorder with out-of-bounds to index', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');

      store.reorderTabs(0, -1);
      expect(store.tabs[0].id).toBe(tab1.id);

      store.reorderTabs(0, 5);
      expect(store.tabs[0].id).toBe(tab1.id);
    });
  });

  describe('saveTabSession', () => {
    it('should save tabs for a connection', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT 1');

      store.saveTabSession('conn-1', 'mydb');

      expect(mockTabsSave).toHaveBeenCalledWith(
        'conn-1',
        'mydb',
        expect.any(String),
        tab.id,
      );
    });

    it('should strip query results from saved tabs', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT 1');
      store.setTabResult(tab.id, mockQueryResult);
      store.setTabExecuting(tab.id, true);

      store.saveTabSession('conn-1', 'mydb');

      const savedJson = mockTabsSave.mock.calls[0][2];
      const savedTabs = JSON.parse(savedJson);
      expect(savedTabs[0].data.result).toBeUndefined();
      expect(savedTabs[0].data.results).toBeUndefined();
      expect(savedTabs[0].data.isExecuting).toBe(false);
      expect(savedTabs[0].data.queryPlan).toBeUndefined();
    });

    it('should delete session when no tabs for connection', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-2');

      store.saveTabSession('conn-1', 'mydb');

      expect(mockTabsDelete).toHaveBeenCalledWith('conn-1', 'mydb');
      expect(mockTabsSave).not.toHaveBeenCalled();
    });
  });

  describe('restoreTabSession', () => {
    it('should restore tabs from saved session', async () => {
      const savedTabs: Tab[] = [
        {
          id: 'restored-1',
          title: 'Query 1',
          data: {
            type: TabType.Query,
            connectionId: 'conn-1',
            sql: 'SELECT 1',
            isExecuting: false,
            isDirty: false,
          },
        },
      ];

      mockTabsLoad.mockResolvedValueOnce({
        tabs_json: JSON.stringify(savedTabs),
        active_tab_id: 'restored-1',
      });

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', true);

      expect(result).toBe(true);
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe('restored-1');
      expect(store.activeTabId).toBe('restored-1');
    });

    it('should not set global activeTabId when not active connection', async () => {
      const savedTabs: Tab[] = [
        {
          id: 'restored-1',
          title: 'Query 1',
          data: {
            type: TabType.Query,
            connectionId: 'conn-1',
            sql: 'SELECT 1',
            isExecuting: false,
            isDirty: false,
          },
        },
      ];

      mockTabsLoad.mockResolvedValueOnce({
        tabs_json: JSON.stringify(savedTabs),
        active_tab_id: 'restored-1',
      });

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', false);

      expect(result).toBe(true);
      expect(store.tabs).toHaveLength(1);
      expect(store.activeTabId).toBeNull();
    });

    it('should return false when no session exists', async () => {
      mockTabsLoad.mockResolvedValueOnce(null);

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', true);

      expect(result).toBe(false);
    });

    it('should return false for empty tabs_json', async () => {
      mockTabsLoad.mockResolvedValueOnce({ tabs_json: null });

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', true);

      expect(result).toBe(false);
    });

    it('should return false for empty array', async () => {
      mockTabsLoad.mockResolvedValueOnce({ tabs_json: '[]' });

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', true);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockTabsLoad.mockRejectedValueOnce(new Error('Load failed'));

      const store = useTabsStore();
      const result = await store.restoreTabSession('conn-1', 'mydb', true);

      expect(result).toBe(false);
    });

    it('should not duplicate existing tabs', async () => {
      const store = useTabsStore();
      // Pre-existing tab with same ID
      store.tabs.push({
        id: 'existing-1',
        title: 'Existing',
        data: {
          type: TabType.Query,
          connectionId: 'conn-1',
          sql: 'OLD SQL',
          isExecuting: false,
          isDirty: false,
        },
      });

      mockTabsLoad.mockResolvedValueOnce({
        tabs_json: JSON.stringify([
          {
            id: 'existing-1',
            title: 'New',
            data: {
              type: TabType.Query,
              connectionId: 'conn-1',
              sql: 'NEW SQL',
              isExecuting: false,
              isDirty: false,
            },
          },
        ]),
        active_tab_id: 'existing-1',
      });

      await store.restoreTabSession('conn-1', 'mydb', true);

      expect(store.tabs).toHaveLength(1);
      // Should keep existing, not overwrite
      expect(store.tabs[0].title).toBe('Existing');
    });

    it('should reset query tab transient state on restore', async () => {
      const savedTabs: Tab[] = [
        {
          id: 'restored-1',
          title: 'Query 1',
          data: {
            type: TabType.Query,
            connectionId: 'conn-1',
            sql: 'SELECT 1',
            isExecuting: true,
            isDirty: false,
            result: mockQueryResult,
            queryPlan: { rows: [], columns: [] },
            showPlan: true,
          },
        },
      ];

      mockTabsLoad.mockResolvedValueOnce({
        tabs_json: JSON.stringify(savedTabs),
        active_tab_id: 'restored-1',
      });

      const store = useTabsStore();
      await store.restoreTabSession('conn-1', 'mydb', true);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.isExecuting).toBe(false);
        expect(store.tabs[0].data.result).toBeUndefined();
        expect(store.tabs[0].data.results).toBeUndefined();
        expect(store.tabs[0].data.queryPlan).toBeUndefined();
        expect(store.tabs[0].data.showPlan).toBeUndefined();
      }
    });
  });

  describe('deleteTabSession', () => {
    it('should call api.tabs.delete', () => {
      const store = useTabsStore();
      store.deleteTabSession('conn-1', 'mydb');

      expect(mockTabsDelete).toHaveBeenCalledWith('conn-1', 'mydb');
    });
  });

  describe('switchToConnection', () => {
    it('should switch to the last active tab for a connection', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      // tab1 for conn-1 was last active before tab2 was created
      store.switchToConnection('conn-1');

      expect(store.activeTabId).toBe(tab1.id);
    });

    it('should fall back to first tab for connection if no saved tab', () => {
      const store = useTabsStore();
      store.tabs.push({
        id: 'manual-1',
        title: 'T1',
        data: { type: TabType.Query, connectionId: 'conn-1', sql: '', isExecuting: false, isDirty: false },
      });

      store.switchToConnection('conn-1');

      expect(store.activeTabId).toBe('manual-1');
    });

    it('should set null if no tabs for connection', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');

      store.switchToConnection('conn-2');

      expect(store.activeTabId).toBeNull();
    });

    it('should save current connection tab before switching', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      // tab2 for conn-2 is active
      store.switchToConnection('conn-1');

      // Now switch back to conn-2
      store.switchToConnection('conn-2');
      expect(store.activeTabId).toBe(tab2.id);
    });
  });
});
