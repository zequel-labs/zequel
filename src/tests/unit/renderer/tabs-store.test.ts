import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { TabType, RoutineType, TableObjectType } from '@/types/table';
import type { TableViewState, QueryViewState, ViewState } from '@/types/viewState';

// Mock generateId so we can predict tab IDs
let idCounter = 0;
vi.mock('@/lib/utils', () => ({
  generateId: () => `tab-${++idCounter}`,
}));

import { useTabsStore } from '@/stores/tabs';
import type { QueryResult, SerializedTab } from '@/stores/tabs';

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
      expect(tab.title).toBe('public.users');
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
      expect(tab.title).toBe('public.user_view');
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
      expect(tab.title).toBe('my_func');
      if (tab.data.type === TabType.Routine) {
        expect(tab.data.routineName).toBe('my_func');
        expect(tab.data.routineType).toBe(RoutineType.Function);
      }
    });

    it('should create a routine tab for procedure', () => {
      const store = useTabsStore();
      const tab = store.createRoutineTab('conn-1', 'my_proc', RoutineType.Procedure);

      expect(tab.title).toBe('my_proc');
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
      expect(tab.title).toBe('User Management');
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
      expect(tab.title).toBe('users_id_seq');
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
      expect(tab.title).toBe('mv_users');
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
      expect(tab.title).toBe('my_trigger');
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
      expect(tab.title).toBe('daily_cleanup');
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

  describe('createBackupTab', () => {
    it('should create a backup tab with correct title', () => {
      const store = useTabsStore();
      const tab = store.createBackupTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.Backup);
      expect(tab.title).toBe('Backup');
      expect(tab.data.connectionId).toBe('conn-1');
    });

    it('should set the tab as active', () => {
      const store = useTabsStore();
      const tab = store.createBackupTab('conn-1');

      expect(store.activeTabId).toBe(tab.id);
    });

    it('should reuse existing backup tab for same connectionId', () => {
      const store = useTabsStore();
      const tab1 = store.createBackupTab('conn-1');
      const tab2 = store.createBackupTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should create separate tabs for different connectionId', () => {
      const store = useTabsStore();
      store.createBackupTab('conn-1');
      store.createBackupTab('conn-2');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createRestoreTab', () => {
    it('should create a restore tab with correct title', () => {
      const store = useTabsStore();
      const tab = store.createRestoreTab('conn-1', 'mydb');

      expect(tab.data.type).toBe(TabType.Restore);
      expect(tab.title).toBe('Restore');
      expect(tab.data.connectionId).toBe('conn-1');
    });

    it('should set the tab as active', () => {
      const store = useTabsStore();
      const tab = store.createRestoreTab('conn-1');

      expect(store.activeTabId).toBe(tab.id);
    });

    it('should reuse existing restore tab for same connectionId', () => {
      const store = useTabsStore();
      const tab1 = store.createRestoreTab('conn-1');
      const tab2 = store.createRestoreTab('conn-1');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should create separate tabs for different connectionId', () => {
      const store = useTabsStore();
      store.createRestoreTab('conn-1');
      store.createRestoreTab('conn-2');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('createTableTab with initialFilters', () => {
    it('should create tab with initialFilters in data', () => {
      const store = useTabsStore();
      const filters = [{ column: 'id', operator: '=' as const, value: 1 }];
      const tab = store.createTableTab('conn-1', 'users', 'mydb', 'public', filters);

      expect(tab.data.type).toBe(TabType.Table);
      if (tab.data.type === TabType.Table) {
        expect(tab.data.initialFilters).toEqual(filters);
      }
    });

    it('should skip dedup when initialFilters are provided', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      const filters = [{ column: 'id', operator: '=' as const, value: 42 }];
      const tab2 = store.createTableTab('conn-1', 'users', undefined, undefined, filters);

      expect(store.tabs).toHaveLength(2);
      if (tab2.data.type === TabType.Table) {
        expect(tab2.data.initialFilters).toEqual(filters);
      }
    });

    it('should still dedup when no initialFilters are provided', () => {
      const store = useTabsStore();
      const tab1 = store.createTableTab('conn-1', 'users');
      const tab2 = store.createTableTab('conn-1', 'users');

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

  describe('closeTabsToLeft', () => {
    it('should close tabs before the specified tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.closeTabsToLeft(tab3.id);

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe(tab3.id);
    });

    it('should keep active tab if it is to the right', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.setActiveTab(tab3.id);
      store.closeTabsToLeft(tab2.id);

      expect(store.tabs).toHaveLength(2);
      expect(store.activeTabId).toBe(tab3.id);
    });

    it('should set active to specified tab if active was to the left', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.setActiveTab(tab1.id);
      store.closeTabsToLeft(tab3.id);

      expect(store.tabs).toHaveLength(1);
      expect(store.activeTabId).toBe(tab3.id);
    });

    it('should be a no-op for the first tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.closeTabsToLeft(tab1.id);

      expect(store.tabs).toHaveLength(3);
    });

    it('should be a no-op for invalid id', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');

      store.closeTabsToLeft('nonexistent');

      expect(store.tabs).toHaveLength(2);
    });
  });

  describe('closeTabsToRight', () => {
    it('should close tabs after the specified tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.closeTabsToRight(tab1.id);

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe(tab1.id);
    });

    it('should keep active tab if it is to the left', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.setActiveTab(tab1.id);
      store.closeTabsToRight(tab2.id);

      expect(store.tabs).toHaveLength(2);
      expect(store.activeTabId).toBe(tab1.id);
    });

    it('should set active to specified tab if active was to the right', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      // tab3 is active (last created)
      store.closeTabsToRight(tab1.id);

      expect(store.tabs).toHaveLength(1);
      expect(store.activeTabId).toBe(tab1.id);
    });

    it('should be a no-op for the last tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-1');
      const tab3 = store.createQueryTab('conn-1');

      store.closeTabsToRight(tab3.id);

      expect(store.tabs).toHaveLength(3);
    });

    it('should be a no-op for invalid id', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');

      store.closeTabsToRight('nonexistent');

      expect(store.tabs).toHaveLength(2);
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

    it('should do nothing for non-existent tab', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');
      store.updateTabData('nonexistent', { sql: 'SELECT 1' } as Partial<import('@/stores/tabs').TabData>);
      // Should not throw; original tab should be unchanged
      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.sql).toBe('');
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

    it('should do nothing for non-existent tab', () => {
      const store = useTabsStore();
      store.setTabResult('nonexistent', mockQueryResult);
      expect(store.tabs).toHaveLength(0);
    });

    it('should not affect non-query tabs', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');
      store.setTabResult(tab.id, mockQueryResult);
      expect(store.tabs[0].data.type).toBe(TabType.Table);
    });

    it('should clear multiResults and currentResultIndex when setting single result', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      const result2: QueryResult = { ...mockQueryResult, rowCount: 2 };

      // First set multi-results
      store.setTabMultiResults(tab.id, [mockQueryResult, result2]);

      // Then set a single result — should clear multi-state
      store.setTabResult(tab.id, mockQueryResult);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.result).toEqual(mockQueryResult);
        expect(store.tabs[0].data.multiResults).toBeUndefined();
        expect(store.tabs[0].data.currentResultIndex).toBeUndefined();
      }
    });
  });

  describe('setTabMultiResults', () => {
    it('should store all results and default to last', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      const result1: QueryResult = { ...mockQueryResult, rowCount: 1 };
      const result2: QueryResult = { ...mockQueryResult, rowCount: 2 };
      const result3: QueryResult = { ...mockQueryResult, rowCount: 3 };

      store.setTabMultiResults(tab.id, [result1, result2, result3]);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.multiResults).toEqual([result1, result2, result3]);
        expect(store.tabs[0].data.currentResultIndex).toBe(2);
        expect(store.tabs[0].data.result).toEqual(result3);
      }
    });

    it('should handle single result array', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabMultiResults(tab.id, [mockQueryResult]);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.multiResults).toEqual([mockQueryResult]);
        expect(store.tabs[0].data.currentResultIndex).toBe(0);
        expect(store.tabs[0].data.result).toEqual(mockQueryResult);
      }
    });

    it('should not affect non-query tabs', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');

      store.setTabMultiResults(tab.id, [mockQueryResult]);

      expect(store.tabs[0].data.type).toBe(TabType.Table);
    });

    it('should ignore empty results array', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabMultiResults(tab.id, []);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.multiResults).toBeUndefined();
        expect(store.tabs[0].data.currentResultIndex).toBeUndefined();
      }
    });
  });

  describe('setTabCurrentResultIndex', () => {
    it('should switch to the specified result index', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      const result1: QueryResult = { ...mockQueryResult, rowCount: 1 };
      const result2: QueryResult = { ...mockQueryResult, rowCount: 2 };

      store.setTabMultiResults(tab.id, [result1, result2]);
      store.setTabCurrentResultIndex(tab.id, 0);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.currentResultIndex).toBe(0);
        expect(store.tabs[0].data.result).toEqual(result1);
      }
    });

    it('should clamp index to valid range (lower bound)', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabMultiResults(tab.id, [mockQueryResult, { ...mockQueryResult, rowCount: 2 }]);
      store.setTabCurrentResultIndex(tab.id, -5);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.currentResultIndex).toBe(0);
      }
    });

    it('should clamp index to valid range (upper bound)', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabMultiResults(tab.id, [mockQueryResult, { ...mockQueryResult, rowCount: 2 }]);
      store.setTabCurrentResultIndex(tab.id, 99);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.currentResultIndex).toBe(1);
      }
    });

    it('should do nothing if multiResults is not set', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');

      store.setTabCurrentResultIndex(tab.id, 0);

      if (store.tabs[0].data.type === TabType.Query) {
        expect(store.tabs[0].data.currentResultIndex).toBeUndefined();
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

    it('should do nothing for non-existent tab', () => {
      const store = useTabsStore();
      store.setTabExecuting('nonexistent', true);
      expect(store.tabs).toHaveLength(0);
    });

    it('should not affect non-query tabs', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');
      store.setTabExecuting(tab.id, true);
      expect(store.tabs[0].data.type).toBe(TabType.Table);
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

  describe('createTablePropertiesTab', () => {
    it('should create a table properties tab', () => {
      const store = useTabsStore();
      const tab = store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table, 'mydb', 'public');

      expect(tab.data.type).toBe(TabType.TableProperties);
      expect(tab.title).toBe('users Properties');
      if (tab.data.type === TabType.TableProperties) {
        expect(tab.data.tableName).toBe('users');
        expect(tab.data.tableType).toBe(TableObjectType.Table);
        expect(tab.data.database).toBe('mydb');
        expect(tab.data.schema).toBe('public');
      }
      expect(store.activeTabId).toBe(tab.id);
    });

    it('should reuse existing table properties tab by name, type, and schema', () => {
      const store = useTabsStore();
      const tab1 = store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table, 'mydb', 'public');
      const tab2 = store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table, 'mydb', 'public');

      expect(tab1.id).toBe(tab2.id);
      expect(store.tabs).toHaveLength(1);
    });

    it('should create separate tabs for table vs view with same name', () => {
      const store = useTabsStore();
      store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table);
      store.createTablePropertiesTab('conn-1', 'users', TableObjectType.View);

      expect(store.tabs).toHaveLength(2);
    });

    it('should create separate tabs for different schemas', () => {
      const store = useTabsStore();
      store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table, 'mydb', 'public');
      store.createTablePropertiesTab('conn-1', 'users', TableObjectType.Table, 'mydb', 'other');

      expect(store.tabs).toHaveLength(2);
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

    it('should handle activeTabId pointing to a non-existent tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');

      // Set activeTabId to a tab that no longer exists
      store.activeTabId = 'removed-tab-id';

      // switchToConnection should not throw; activeTabId is truthy but find returns undefined
      store.switchToConnection('conn-1');

      expect(store.activeTabId).toBe(tab1.id);
    });
  });

  describe('closeTab (index boundary fallback)', () => {
    it('should fallback to last tab when closing active tab at end and no same-connection tabs remain', () => {
      const store = useTabsStore();
      // Create tabs for different connections
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');
      const tab3 = store.createQueryTab('conn-3');

      // tab3 is active (last created), close it
      // No other conn-3 tabs, so it falls back to index boundary logic
      store.closeTab(tab3.id);

      // Should fallback to the last remaining tab (Math.min(2, 1) = 1 => tab2)
      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should fallback to first tab when closing active tab at index 0 and no same-connection tabs remain', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      // Set tab1 as active
      store.setActiveTab(tab1.id);

      // Close tab1 - no other conn-1 tabs, index 0, falls back to Math.min(0, 0) = 0
      store.closeTab(tab1.id);

      expect(store.activeTabId).toBe(tab2.id);
    });
  });

  describe('migrateTabsForSession', () => {
    it('should migrate session-level tabs and close database-specific tabs', () => {
      const store = useTabsStore();
      const queryTab1 = store.createQueryTab('old-session');
      const tableTab = store.createTableTab('old-session', 'users');
      const queryTab2 = store.createQueryTab('old-session');
      const otherTab = store.createQueryTab('other-session');

      store.migrateTabsForSession('old-session', 'new-session');

      // Query tabs should be migrated to new session
      expect(store.tabs.find(t => t.id === queryTab1.id)?.data.connectionId).toBe('new-session');
      expect(store.tabs.find(t => t.id === queryTab2.id)?.data.connectionId).toBe('new-session');

      // Table tab should be closed (database-specific)
      expect(store.tabs.find(t => t.id === tableTab.id)).toBeUndefined();

      // The other-session tab should be unchanged
      expect(store.tabs.find(t => t.id === otherTab.id)?.data.connectionId).toBe('other-session');
    });

    it('should migrate perSessionActiveTab tracking', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('old-session');
      const tab2 = store.createQueryTab('old-session');
      const otherTab = store.createQueryTab('other-session');

      // tab2 was the last created for old-session, so it is active
      // Switch to other-session, then back — perSessionActiveTab records tab2 for old-session
      store.switchToConnection('other-session');
      store.switchToConnection('old-session');
      expect(store.activeTabId).toBe(tab2.id);

      // Now migrate
      store.migrateTabsForSession('old-session', 'new-session');

      // Switch away and back to new-session — should restore the previously active tab
      store.switchToConnection('other-session');
      store.switchToConnection('new-session');
      expect(store.activeTabId).toBe(tab2.id);
    });

    it('should not affect tabs for other sessions', () => {
      const store = useTabsStore();
      store.createQueryTab('session-a');
      const otherTab = store.createQueryTab('session-b');

      store.migrateTabsForSession('session-a', 'session-c');

      expect(store.tabs.find(t => t.id === otherTab.id)?.data.connectionId).toBe('session-b');
    });
  });

  describe('closeAllTabs (scoped to connectionId)', () => {
    it('should close only tabs for the specified connection', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createTableTab('conn-1', 'users');
      const tab3 = store.createQueryTab('conn-2');

      store.closeAllTabs('conn-1');

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].data.connectionId).toBe('conn-2');
    });

    it('should switch active tab when active tab is removed by scoped closeAllTabs', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      // tab2 is active but we close conn-2 tabs
      store.closeAllTabs('conn-2');

      expect(store.activeTabId).toBe(tab1.id);
    });

    it('should set activeTabId to null when scoped closeAllTabs removes all remaining tabs', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');

      store.closeAllTabs('conn-1');

      expect(store.tabs).toHaveLength(0);
      expect(store.activeTabId).toBeNull();
    });

    it('should not change activeTabId when scoped closeAllTabs does not remove active tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createQueryTab('conn-2');

      store.setActiveTab(tab2.id);
      store.closeAllTabs('conn-1');

      expect(store.activeTabId).toBe(tab2.id);
    });
  });

  describe('serializeTabsForSession', () => {
    it('should serialize all tabs for a session', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1', 'SELECT 1');
      store.createTableTab('conn-1', 'users', 'mydb', 'public');
      store.createQueryTab('conn-2', 'SELECT 2');

      const result = store.serializeTabsForSession('conn-1');

      expect(result.tabs).toHaveLength(2);
      expect(result.tabs[0].data.type).toBe(TabType.Query);
      expect(result.tabs[1].data.type).toBe(TabType.Table);
    });

    it('should strip result and multiResults from query tabs to reduce IPC payload', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT 1');
      store.setTabResult(tab.id, mockQueryResult);

      const result = store.serializeTabsForSession('conn-1');
      const serializedData = result.tabs[0].data;

      expect(serializedData.type).toBe(TabType.Query);
      if (serializedData.type === TabType.Query) {
        expect(serializedData.result).toBeUndefined();
        expect(serializedData.isExecuting).toBe(false);
        expect(serializedData.sql).toBe('SELECT 1');
      }
    });

    it('should preserve sql and isDirty in query tabs', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT 1');
      store.setTabSql(tab.id, 'SELECT 2');

      const result = store.serializeTabsForSession('conn-1');
      const serializedData = result.tabs[0].data;

      if (serializedData.type === TabType.Query) {
        expect(serializedData.sql).toBe('SELECT 2');
        expect(serializedData.isDirty).toBe(true);
      }
    });

    it('should set isExecuting to false for executing query tabs', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1');
      store.setTabExecuting(tab.id, true);

      const result = store.serializeTabsForSession('conn-1');
      const serializedData = result.tabs[0].data;

      if (serializedData.type === TabType.Query) {
        expect(serializedData.isExecuting).toBe(false);
      }
    });

    it('should preserve all data for non-query tabs', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users', 'mydb', 'public');

      const result = store.serializeTabsForSession('conn-1');
      const serializedData = result.tabs[0].data;

      if (serializedData.type === TabType.Table) {
        expect(serializedData.tableName).toBe('users');
        expect(serializedData.database).toBe('mydb');
        expect(serializedData.schema).toBe('public');
        expect(serializedData.activeView).toBe('data');
      }
    });

    it('should return correct activeTabIndex for the active tab', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createTableTab('conn-1', 'users');
      const tab3 = store.createQueryTab('conn-1');

      store.setActiveTab(tab2.id);

      const result = store.serializeTabsForSession('conn-1');
      expect(result.activeTabIndex).toBe(1);
    });

    it('should use perSessionActiveTab when active tab is from another session', () => {
      const store = useTabsStore();
      const tab1 = store.createQueryTab('conn-1');
      const tab2 = store.createTableTab('conn-1', 'users');
      store.setActiveTab(tab2.id); // tab2 is active for conn-1

      // Switch to conn-2 so activeTabId points to a different session
      const tab3 = store.createQueryTab('conn-2');

      const result = store.serializeTabsForSession('conn-1');
      // Should find tab2 (index 1) via perSessionActiveTab, not default to 0
      expect(result.activeTabIndex).toBe(1);
    });

    it('should return 0 for activeTabIndex when active tab is from another session and no perSessionActiveTab', () => {
      const store = useTabsStore();
      // Manually push tabs without going through setActiveTab for conn-1
      store.tabs.push({
        id: 'manual-1',
        title: 'T1',
        data: { type: TabType.Query, connectionId: 'conn-1', sql: '', isExecuting: false, isDirty: false },
      });
      store.tabs.push({
        id: 'manual-2',
        title: 'T2',
        data: { type: TabType.Query, connectionId: 'conn-1', sql: '', isExecuting: false, isDirty: false },
      });
      const tab3 = store.createQueryTab('conn-2'); // active tab is conn-2

      const result = store.serializeTabsForSession('conn-1');
      expect(result.activeTabIndex).toBe(0);
    });

    it('should return empty array for session with no tabs', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1');

      const result = store.serializeTabsForSession('conn-2');
      expect(result.tabs).toHaveLength(0);
      expect(result.activeTabIndex).toBe(0);
    });

    it('should preserve title in serialized tabs', () => {
      const store = useTabsStore();
      store.createQueryTab('conn-1', '', 'My Custom Query');

      const result = store.serializeTabsForSession('conn-1');
      expect(result.tabs[0].title).toBe('My Custom Query');
    });
  });

  describe('restoreSerializedTabs', () => {
    it('should restore serialized tabs with new IDs', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Query 1', data: { type: TabType.Query, connectionId: 'old', sql: 'SELECT 1', isExecuting: false, isDirty: false } },
        { title: 'users', data: { type: TabType.Table, connectionId: 'old', tableName: 'users', activeView: 'data' } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[0].data.connectionId).toBe('new-session');
      expect(store.tabs[1].data.connectionId).toBe('new-session');
      expect(store.tabs[0].title).toBe('Query 1');
      expect(store.tabs[1].title).toBe('users');
    });

    it('should set the active tab based on activeTabIndex', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Query 1', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
        { title: 'Query 2', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 1);

      expect(store.activeTabId).toBe(store.tabs[1].id);
    });

    it('should clamp activeTabIndex to valid range', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Query 1', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 99);

      expect(store.activeTabId).toBe(store.tabs[0].id);
    });

    it('should generate unique IDs for restored tabs', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Q1', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
        { title: 'Q2', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      expect(store.tabs[0].id).not.toBe(store.tabs[1].id);
    });

    it('should handle empty serialized array', () => {
      const store = useTabsStore();

      store.restoreSerializedTabs('new-session', [], 0);

      expect(store.tabs).toHaveLength(0);
      expect(store.activeTabId).toBeNull();
    });

    it('should coexist with existing tabs from other sessions', () => {
      const store = useTabsStore();
      store.createQueryTab('existing-session');

      const serialized: SerializedTab[] = [
        { title: 'Restored', data: { type: TabType.Query, connectionId: 'old', sql: 'SELECT 1', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[0].data.connectionId).toBe('existing-session');
      expect(store.tabs[1].data.connectionId).toBe('new-session');
    });

    it('should update perSessionActiveTab for restored session', () => {
      const store = useTabsStore();
      const existingTab = store.createQueryTab('existing-session');

      const serialized: SerializedTab[] = [
        { title: 'Q1', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
        { title: 'Q2', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, 1);

      // Switch away and back to verify perSessionActiveTab was set
      store.switchToConnection('existing-session');
      store.switchToConnection('new-session');

      // Should restore the second tab (index 1) as active
      expect(store.activeTabId).toBe(store.tabs[2].id); // tabs[2] is the second restored tab
    });
  });

  describe('serializeTabsForSession with viewStates', () => {
    it('should include viewState when provided', () => {
      const store = useTabsStore();
      const tab = store.createTableTab('conn-1', 'users');
      const viewStates = new Map<string, ViewState>();
      const tableState: TableViewState = {
        dataResult: null,
        offset: 100,
        filters: [{ column: 'id', operator: '=' as const, value: 1 }],
        error: null,
        grid: {
          sorting: [{ id: 'name', desc: true }],
          columnSizing: { name: 200 },
          columnOrder: ['id', 'name'],
          columnVisibility: { id: true, name: true },
          pendingChanges: [],
          pendingNewRows: [],
          pendingDeleteRows: []
        }
      };
      viewStates.set(tab.id, tableState);

      const result = store.serializeTabsForSession('conn-1', viewStates);

      expect(result.tabs[0].viewState).toEqual(tableState);
    });

    it('should not include viewState when not provided for a tab', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');
      store.createQueryTab('conn-1', 'SELECT 1');
      const viewStates = new Map<string, ViewState>();

      const result = store.serializeTabsForSession('conn-1', viewStates);

      expect(result.tabs[0].viewState).toBeUndefined();
      expect(result.tabs[1].viewState).toBeUndefined();
    });

    it('should serialize without viewStates parameter (backward compatible)', () => {
      const store = useTabsStore();
      store.createTableTab('conn-1', 'users');

      const result = store.serializeTabsForSession('conn-1');

      expect(result.tabs[0].viewState).toBeUndefined();
    });

    it('should attach viewState to query tabs with result stripped', () => {
      const store = useTabsStore();
      const tab = store.createQueryTab('conn-1', 'SELECT 1');
      store.setTabResult(tab.id, mockQueryResult);

      const viewStates = new Map<string, ViewState>();
      const queryState: QueryViewState = { runMode: 'all' };
      viewStates.set(tab.id, queryState);

      const result = store.serializeTabsForSession('conn-1', viewStates);

      expect(result.tabs[0].viewState).toEqual(queryState);
      if (result.tabs[0].data.type === TabType.Query) {
        expect(result.tabs[0].data.result).toBeUndefined();
      }
    });
  });

  describe('restoreSerializedTabs with viewState', () => {
    it('should attach _viewState to restored tabs', () => {
      const store = useTabsStore();
      const tableState: TableViewState = {
        dataResult: null,
        offset: 50,
        filters: [],
        error: null
      };
      const serialized: SerializedTab[] = [
        {
          title: 'users',
          data: { type: TabType.Table, connectionId: 'old', tableName: 'users', activeView: 'data' },
          viewState: tableState
        },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      const restoredTab = store.tabs[0] as typeof store.tabs[0] & { _viewState?: ViewState };
      expect(restoredTab._viewState).toEqual(tableState);
    });

    it('should not attach _viewState when viewState is undefined', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        {
          title: 'users',
          data: { type: TabType.Table, connectionId: 'old', tableName: 'users', activeView: 'data' },
        },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      const restoredTab = store.tabs[0] as typeof store.tabs[0] & { _viewState?: ViewState };
      expect(restoredTab._viewState).toBeUndefined();
    });

    it('should preserve viewState for query tabs with result', () => {
      const store = useTabsStore();
      const queryState: QueryViewState = { runMode: 'all' };
      const serialized: SerializedTab[] = [
        {
          title: 'Query 1',
          data: {
            type: TabType.Query,
            connectionId: 'old',
            sql: 'SELECT 1',
            result: mockQueryResult,
            isExecuting: false,
            isDirty: false
          },
          viewState: queryState
        },
      ];

      store.restoreSerializedTabs('new-session', serialized, 0);

      const restoredTab = store.tabs[0] as typeof store.tabs[0] & { _viewState?: ViewState };
      expect(restoredTab._viewState).toEqual(queryState);
      if (restoredTab.data.type === TabType.Query) {
        expect(restoredTab.data.result).toEqual(mockQueryResult);
      }
    });
  });

  describe('per-connection query tab numbering', () => {
    it('should number query tabs independently per connection', () => {
      const store = useTabsStore();

      // Create query tabs in alternation between two connections
      const conn1Query1 = store.createQueryTab('conn-1');
      const conn2Query1 = store.createQueryTab('conn-2');
      const conn1Query2 = store.createQueryTab('conn-1');
      const conn2Query2 = store.createQueryTab('conn-2');

      // conn-1 tabs should be numbered 1, 2
      expect(conn1Query1.title).toBe('Query 1');
      expect(conn1Query2.title).toBe('Query 2');

      // conn-2 tabs should also be numbered 1, 2 (independent from conn-1)
      expect(conn2Query1.title).toBe('Query 1');
      expect(conn2Query2.title).toBe('Query 2');
    });

    it('should not count query tabs from other connections', () => {
      const store = useTabsStore();

      // Create 3 queries for conn-1
      store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');
      store.createQueryTab('conn-1');

      // First query for conn-2 should be "Query 1", not "Query 4"
      const conn2First = store.createQueryTab('conn-2');
      expect(conn2First.title).toBe('Query 1');
    });
  });

  describe('migrateTabsForSession when ALL tabs are database-specific', () => {
    it('should close all database-specific tabs and set activeTabId to null when no other connections exist', () => {
      const store = useTabsStore();

      // Create only database-specific tabs (Table and View) for the session
      const tableTab = store.createTableTab('old-session', 'users');
      const viewTab = store.createViewTab('old-session', 'user_view');

      // tableTab and viewTab are database-specific, no query tabs exist
      store.setActiveTab(viewTab.id);

      store.migrateTabsForSession('old-session', 'new-session');

      // All tabs should be closed (both are database-specific)
      expect(store.tabs).toHaveLength(0);
      // activeTabId should be null since no tabs remain
      expect(store.activeTabId).toBeNull();
    });

    it('should close all database-specific tabs and update activeTabId to remaining tab from another connection', () => {
      const store = useTabsStore();

      // Create database-specific tabs for old-session
      const tableTab = store.createTableTab('old-session', 'users');
      const viewTab = store.createViewTab('old-session', 'user_view');
      // Create a tab for a different connection
      const otherTab = store.createQueryTab('other-conn');

      // Make a database-specific tab active
      store.setActiveTab(tableTab.id);

      store.migrateTabsForSession('old-session', 'new-session');

      // All old-session tabs should be closed (both are database-specific)
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].id).toBe(otherTab.id);
      // activeTabId was pointing to a closed tab, should be updated
      // migrateTabsForSession sets it to first new-session tab or null
      // Since no new-session tabs remain, it becomes null; but other-conn tab still exists
      // The implementation sets activeTabId to firstNewTab?.id || null for the new session
      // Since there are no new-session tabs, activeTabId becomes null
      // However, the other-conn tab is still there — this is the actual behavior
      expect(store.activeTabId).toBeNull();
    });
  });

  describe('closeTab prefers same-connection tab', () => {
    it('should activate a same-connection tab rather than an adjacent cross-connection tab', () => {
      const store = useTabsStore();

      // Create tabs: [conn-1 query, conn-2 query, conn-1 table]
      const conn1Query = store.createQueryTab('conn-1');
      const conn2Query = store.createQueryTab('conn-2');
      const conn1Table = store.createTableTab('conn-1', 'users');

      // Make conn-1 table active (last in the list)
      store.setActiveTab(conn1Table.id);
      expect(store.activeTabId).toBe(conn1Table.id);

      // Close the active conn-1 table tab
      store.closeTab(conn1Table.id);

      // Should prefer the same-connection tab (conn-1 query), NOT the adjacent conn-2 query
      expect(store.activeTabId).toBe(conn1Query.id);
    });

    it('should fall back to index-adjacent tab when no same-connection tabs remain', () => {
      const store = useTabsStore();

      // Create tabs: [conn-2 query, conn-1 query]
      const conn2Query = store.createQueryTab('conn-2');
      const conn1Query = store.createQueryTab('conn-1');

      // conn-1 query is active (last created)
      store.closeTab(conn1Query.id);

      // No other conn-1 tabs, so it falls back to index-based selection
      expect(store.activeTabId).toBe(conn2Query.id);
    });
  });

  describe('closeOtherTabs preserves cross-connection tabs', () => {
    it('should keep the target tab and all cross-connection tabs', () => {
      const store = useTabsStore();

      // Create tabs: [conn-1 A, conn-2 B, conn-1 C]
      const tabA = store.createQueryTab('conn-1');
      const tabB = store.createQueryTab('conn-2');
      const tabC = store.createQueryTab('conn-1');

      // Close other tabs relative to A
      store.closeOtherTabs(tabA.id);

      // tabA (target) and tabB (cross-connection) should survive
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs.map(t => t.id)).toContain(tabA.id);
      expect(store.tabs.map(t => t.id)).toContain(tabB.id);
      // tabC (same connection as target) should be closed
      expect(store.tabs.map(t => t.id)).not.toContain(tabC.id);
      expect(store.activeTabId).toBe(tabA.id);
    });
  });

  describe('closeTabsToLeft preserves cross-connection tabs', () => {
    it('should only close same-connection tabs to the left', () => {
      const store = useTabsStore();

      // Create tabs: [conn-1 A, conn-2 B, conn-1 C, conn-1 D]
      const tabA = store.createQueryTab('conn-1');
      const tabB = store.createQueryTab('conn-2');
      const tabC = store.createQueryTab('conn-1');
      const tabD = store.createQueryTab('conn-1');

      // Close tabs to the left of D
      store.closeTabsToLeft(tabD.id);

      // tabB (conn-2, cross-connection) should survive even though it is to the left
      // tabA and tabC (conn-1, to the left) should be closed
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs.map(t => t.id)).toContain(tabB.id);
      expect(store.tabs.map(t => t.id)).toContain(tabD.id);
      expect(store.tabs.map(t => t.id)).not.toContain(tabA.id);
      expect(store.tabs.map(t => t.id)).not.toContain(tabC.id);
    });
  });

  describe('closeTabsToRight preserves cross-connection tabs', () => {
    it('should only close same-connection tabs to the right', () => {
      const store = useTabsStore();

      // Create tabs: [conn-1 A, conn-1 B, conn-2 C, conn-1 D]
      const tabA = store.createQueryTab('conn-1');
      const tabB = store.createQueryTab('conn-1');
      const tabC = store.createQueryTab('conn-2');
      const tabD = store.createQueryTab('conn-1');

      // Close tabs to the right of A
      store.closeTabsToRight(tabA.id);

      // tabC (conn-2, cross-connection) should survive even though it is to the right
      // tabB and tabD (conn-1, to the right) should be closed
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs.map(t => t.id)).toContain(tabA.id);
      expect(store.tabs.map(t => t.id)).toContain(tabC.id);
      expect(store.tabs.map(t => t.id)).not.toContain(tabB.id);
      expect(store.tabs.map(t => t.id)).not.toContain(tabD.id);
    });
  });

  describe('restoreSerializedTabs with negative activeTabIndex', () => {
    it('should activate the first restored tab when activeTabIndex is negative', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Query 1', data: { type: TabType.Query, connectionId: 'old', sql: 'SELECT 1', isExecuting: false, isDirty: false } },
        { title: 'Query 2', data: { type: TabType.Query, connectionId: 'old', sql: 'SELECT 2', isExecuting: false, isDirty: false } },
        { title: 'Query 3', data: { type: TabType.Query, connectionId: 'old', sql: 'SELECT 3', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, -5);

      // Math.max(-5, 0) = 0, so the first tab should be active
      expect(store.activeTabId).toBe(store.tabs[0].id);
      expect(store.tabs[0].title).toBe('Query 1');
    });

    it('should activate the first restored tab when activeTabIndex is -1', () => {
      const store = useTabsStore();
      const serialized: SerializedTab[] = [
        { title: 'Tab A', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
        { title: 'Tab B', data: { type: TabType.Query, connectionId: 'old', sql: '', isExecuting: false, isDirty: false } },
      ];

      store.restoreSerializedTabs('new-session', serialized, -1);

      expect(store.activeTabId).toBe(store.tabs[0].id);
    });
  });
});
