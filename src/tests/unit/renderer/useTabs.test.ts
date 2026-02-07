import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTabs } from '@/composables/useTabs';
import { useTabsStore } from '@/stores/tabs';
import { useConnectionsStore } from '@/stores/connections';
import { RoutineType, TabType } from '@/types/table';

// Mock window.api
vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
    connections: {
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      test: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFolders: vi.fn().mockResolvedValue([]),
      reconnect: vi.fn(),
      updateFolder: vi.fn(),
      renameFolder: vi.fn(),
      updatePositions: vi.fn(),
      deleteFolder: vi.fn(),
    },
    schema: {
      databases: vi.fn(),
      tables: vi.fn().mockResolvedValue([]),
    },
    connectionStatus: {
      onChange: vi.fn(),
    },
    theme: {
      set: vi.fn(),
      onChange: vi.fn(),
    },
    tabs: {
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
    },
  },
  matchMedia: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
  localStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  },
  dispatchEvent: vi.fn(),
});

const setupActiveConnection = () => {
  const connectionsStore = useConnectionsStore();
  connectionsStore.activeConnectionId = 'conn-1';
  connectionsStore.connections = [
    {
      id: 'conn-1',
      name: 'Test DB',
      type: 'postgresql' as never,
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      filepath: null,
      ssl: false,
      ssh: null,
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastConnectedAt: null,
    },
  ];
};

describe('useTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('computed state', () => {
    it('should have empty tabs initially', () => {
      const { tabs } = useTabs();
      expect(tabs.value).toEqual([]);
    });

    it('should have null activeTab initially', () => {
      const { activeTab } = useTabs();
      expect(activeTab.value).toBeNull();
    });

    it('should have null activeTabId initially', () => {
      const { activeTabId } = useTabs();
      expect(activeTabId.value).toBeNull();
    });

    it('should have hasUnsavedChanges as false initially', () => {
      const { hasUnsavedChanges } = useTabs();
      expect(hasUnsavedChanges.value).toBe(false);
    });

    it('should reflect tabs from the store', () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      tabsStore.createQueryTab('conn-1', 'SELECT 1');
      tabsStore.createQueryTab('conn-1', 'SELECT 2');

      const { tabs } = useTabs();
      expect(tabs.value.length).toBe(2);
    });

    it('should reflect activeTab from the store', () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', 'SELECT 1');

      const { activeTab } = useTabs();
      expect(activeTab.value).not.toBeNull();
      expect(activeTab.value!.id).toBe(tab.id);
    });
  });

  describe('openQueryTab', () => {
    it('should return null when no active connection', () => {
      const { openQueryTab } = useTabs();
      const result = openQueryTab();
      expect(result).toBeNull();
    });

    it('should create a query tab with default empty SQL', () => {
      setupActiveConnection();
      const { openQueryTab, tabs } = useTabs();
      const tab = openQueryTab();

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Query);
    });

    it('should create a query tab with provided SQL', () => {
      setupActiveConnection();
      const { openQueryTab } = useTabs();
      const tab = openQueryTab('SELECT * FROM users');

      expect(tab).not.toBeNull();
      if (tab && tab.data.type === TabType.Query) {
        expect(tab.data.sql).toBe('SELECT * FROM users');
      }
    });

    it('should set the new tab as active', () => {
      setupActiveConnection();
      const { openQueryTab, activeTabId } = useTabs();
      const tab = openQueryTab();

      expect(activeTabId.value).toBe(tab!.id);
    });
  });

  describe('openTableTab', () => {
    it('should return null when no active connection', () => {
      const { openTableTab } = useTabs();
      const result = openTableTab('users');
      expect(result).toBeNull();
    });

    it('should create a table tab', () => {
      setupActiveConnection();
      const { openTableTab, tabs } = useTabs();
      const tab = openTableTab('users');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Table);
      expect(tab!.title).toBe('users');
    });

    it('should create a table tab with database and schema', () => {
      setupActiveConnection();
      const { openTableTab } = useTabs();
      const tab = openTableTab('users', 'mydb', 'public');

      expect(tab).not.toBeNull();
      if (tab && tab.data.type === TabType.Table) {
        expect(tab.data.database).toBe('mydb');
        expect(tab.data.schema).toBe('public');
      }
    });

    it('should reuse existing table tab', () => {
      setupActiveConnection();
      const { openTableTab, tabs } = useTabs();
      const tab1 = openTableTab('users');
      const tab2 = openTableTab('users');

      expect(tabs.value.length).toBe(1);
      expect(tab1!.id).toBe(tab2!.id);
    });
  });

  describe('openViewTab', () => {
    it('should return null when no active connection', () => {
      const { openViewTab } = useTabs();
      const result = openViewTab('active_users');
      expect(result).toBeNull();
    });

    it('should create a view tab', () => {
      setupActiveConnection();
      const { openViewTab, tabs } = useTabs();
      const tab = openViewTab('active_users');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.View);
      expect(tab!.title).toBe('active_users');
    });

    it('should reuse existing view tab', () => {
      setupActiveConnection();
      const { openViewTab, tabs } = useTabs();
      openViewTab('active_users');
      openViewTab('active_users');

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openERDiagramTab', () => {
    it('should return null when no active connection', () => {
      const { openERDiagramTab } = useTabs();
      const result = openERDiagramTab();
      expect(result).toBeNull();
    });

    it('should create an ER diagram tab', () => {
      setupActiveConnection();
      const { openERDiagramTab, tabs } = useTabs();
      const tab = openERDiagramTab('mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.ERDiagram);
      expect(tab!.title).toBe('ER Diagram');
    });

    it('should reuse existing ER diagram tab', () => {
      setupActiveConnection();
      const { openERDiagramTab, tabs } = useTabs();
      openERDiagramTab();
      openERDiagramTab();

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openRoutineTab', () => {
    it('should return null when no active connection', () => {
      const { openRoutineTab } = useTabs();
      const result = openRoutineTab('my_proc', RoutineType.Procedure);
      expect(result).toBeNull();
    });

    it('should create a procedure tab', () => {
      setupActiveConnection();
      const { openRoutineTab, tabs } = useTabs();
      const tab = openRoutineTab('my_proc', RoutineType.Procedure);

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Routine);
      expect(tab!.title).toContain('my_proc');
      expect(tab!.title).toContain('SP');
    });

    it('should create a function tab', () => {
      setupActiveConnection();
      const { openRoutineTab } = useTabs();
      const tab = openRoutineTab('my_func', RoutineType.Function);

      expect(tab).not.toBeNull();
      expect(tab!.title).toContain('FN');
    });

    it('should create a routine tab with database and schema', () => {
      setupActiveConnection();
      const { openRoutineTab } = useTabs();
      const tab = openRoutineTab('my_proc', RoutineType.Procedure, 'mydb', 'public');

      expect(tab).not.toBeNull();
      if (tab && tab.data.type === TabType.Routine) {
        expect(tab.data.database).toBe('mydb');
        expect(tab.data.schema).toBe('public');
      }
    });

    it('should reuse existing routine tab', () => {
      setupActiveConnection();
      const { openRoutineTab, tabs } = useTabs();
      openRoutineTab('my_proc', RoutineType.Procedure);
      openRoutineTab('my_proc', RoutineType.Procedure);

      expect(tabs.value.length).toBe(1);
    });

    it('should create separate tabs for same-name procedure and function', () => {
      setupActiveConnection();
      const { openRoutineTab, tabs } = useTabs();
      openRoutineTab('dual_purpose', RoutineType.Procedure);
      openRoutineTab('dual_purpose', RoutineType.Function);

      expect(tabs.value.length).toBe(2);
    });
  });

  describe('openUsersTab', () => {
    it('should return null when no active connection', () => {
      const { openUsersTab } = useTabs();
      const result = openUsersTab();
      expect(result).toBeNull();
    });

    it('should create a users tab', () => {
      setupActiveConnection();
      const { openUsersTab, tabs } = useTabs();
      const tab = openUsersTab('mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Users);
      expect(tab!.title).toBe('User Management');
    });

    it('should reuse existing users tab', () => {
      setupActiveConnection();
      const { openUsersTab, tabs } = useTabs();
      openUsersTab();
      openUsersTab();

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openMonitoringTab', () => {
    it('should return null when no active connection', () => {
      const { openMonitoringTab } = useTabs();
      const result = openMonitoringTab();
      expect(result).toBeNull();
    });

    it('should create a monitoring tab', () => {
      setupActiveConnection();
      const { openMonitoringTab, tabs } = useTabs();
      const tab = openMonitoringTab('mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Monitoring);
      expect(tab!.title).toBe('Process Monitor');
    });

    it('should reuse existing monitoring tab', () => {
      setupActiveConnection();
      const { openMonitoringTab, tabs } = useTabs();
      openMonitoringTab();
      openMonitoringTab();

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openEventTab', () => {
    it('should return null when no active connection', () => {
      const { openEventTab } = useTabs();
      const result = openEventTab('my_event');
      expect(result).toBeNull();
    });

    it('should create an event tab', () => {
      setupActiveConnection();
      const { openEventTab, tabs } = useTabs();
      const tab = openEventTab('my_event', 'mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Event);
      expect(tab!.title).toContain('my_event');
    });

    it('should reuse existing event tab', () => {
      setupActiveConnection();
      const { openEventTab, tabs } = useTabs();
      openEventTab('my_event');
      openEventTab('my_event');

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openTriggerTab', () => {
    it('should return null when no active connection', () => {
      const { openTriggerTab } = useTabs();
      const result = openTriggerTab('my_trigger', 'users');
      expect(result).toBeNull();
    });

    it('should create a trigger tab', () => {
      setupActiveConnection();
      const { openTriggerTab, tabs } = useTabs();
      const tab = openTriggerTab('my_trigger', 'users', 'mydb', 'public');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Trigger);
      expect(tab!.title).toContain('my_trigger');
    });

    it('should reuse existing trigger tab', () => {
      setupActiveConnection();
      const { openTriggerTab, tabs } = useTabs();
      openTriggerTab('my_trigger', 'users');
      openTriggerTab('my_trigger', 'users');

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openSequenceTab', () => {
    it('should return null when no active connection', () => {
      const { openSequenceTab } = useTabs();
      const result = openSequenceTab('users_id_seq');
      expect(result).toBeNull();
    });

    it('should create a sequence tab', () => {
      setupActiveConnection();
      const { openSequenceTab, tabs } = useTabs();
      const tab = openSequenceTab('users_id_seq', 'public', 'mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Sequence);
      expect(tab!.title).toContain('users_id_seq');
    });

    it('should reuse existing sequence tab', () => {
      setupActiveConnection();
      const { openSequenceTab, tabs } = useTabs();
      openSequenceTab('users_id_seq', 'public');
      openSequenceTab('users_id_seq', 'public');

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openMaterializedViewTab', () => {
    it('should return null when no active connection', () => {
      const { openMaterializedViewTab } = useTabs();
      const result = openMaterializedViewTab('mv_stats');
      expect(result).toBeNull();
    });

    it('should create a materialized view tab', () => {
      setupActiveConnection();
      const { openMaterializedViewTab, tabs } = useTabs();
      const tab = openMaterializedViewTab('mv_stats', 'public', 'mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.MaterializedView);
      expect(tab!.title).toContain('mv_stats');
    });

    it('should reuse existing materialized view tab', () => {
      setupActiveConnection();
      const { openMaterializedViewTab, tabs } = useTabs();
      openMaterializedViewTab('mv_stats', 'public');
      openMaterializedViewTab('mv_stats', 'public');

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openExtensionsTab', () => {
    it('should return null when no active connection', () => {
      const { openExtensionsTab } = useTabs();
      const result = openExtensionsTab();
      expect(result).toBeNull();
    });

    it('should create an extensions tab', () => {
      setupActiveConnection();
      const { openExtensionsTab, tabs } = useTabs();
      const tab = openExtensionsTab('mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Extensions);
      expect(tab!.title).toBe('Extensions');
    });

    it('should reuse existing extensions tab', () => {
      setupActiveConnection();
      const { openExtensionsTab, tabs } = useTabs();
      openExtensionsTab();
      openExtensionsTab();

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('openEnumsTab', () => {
    it('should return null when no active connection', () => {
      const { openEnumsTab } = useTabs();
      const result = openEnumsTab();
      expect(result).toBeNull();
    });

    it('should create an enums tab', () => {
      setupActiveConnection();
      const { openEnumsTab, tabs } = useTabs();
      const tab = openEnumsTab('public', 'mydb');

      expect(tab).not.toBeNull();
      expect(tabs.value.length).toBe(1);
      expect(tab!.data.type).toBe(TabType.Enums);
      expect(tab!.title).toBe('Enums');
    });

    it('should reuse existing enums tab', () => {
      setupActiveConnection();
      const { openEnumsTab, tabs } = useTabs();
      openEnumsTab();
      openEnumsTab();

      expect(tabs.value.length).toBe(1);
    });
  });

  describe('closeTab', () => {
    it('should close a tab by id', () => {
      setupActiveConnection();
      const { openQueryTab, closeTab, tabs } = useTabs();
      const tab = openQueryTab('SELECT 1');
      closeTab(tab!.id);

      expect(tabs.value.length).toBe(0);
    });

    it('should update activeTabId after closing active tab', () => {
      setupActiveConnection();
      const { openQueryTab, closeTab, activeTabId } = useTabs();
      openQueryTab('SELECT 1');
      const tab2 = openQueryTab('SELECT 2');
      closeTab(tab2!.id);

      expect(activeTabId.value).not.toBe(tab2!.id);
    });
  });

  describe('closeAllTabs', () => {
    it('should close all tabs', () => {
      setupActiveConnection();
      const { openQueryTab, closeAllTabs, tabs, activeTabId } = useTabs();
      openQueryTab('SELECT 1');
      openQueryTab('SELECT 2');
      closeAllTabs();

      expect(tabs.value.length).toBe(0);
      expect(activeTabId.value).toBeNull();
    });
  });

  describe('closeOtherTabs', () => {
    it('should close all tabs except the specified one', () => {
      setupActiveConnection();
      const { openQueryTab, closeOtherTabs, tabs } = useTabs();
      openQueryTab('SELECT 1');
      const keepTab = openQueryTab('SELECT 2');
      openQueryTab('SELECT 3');

      closeOtherTabs(keepTab!.id);

      expect(tabs.value.length).toBe(1);
      expect(tabs.value[0].id).toBe(keepTab!.id);
    });
  });

  describe('setActiveTab', () => {
    it('should set the active tab', () => {
      setupActiveConnection();
      const { openQueryTab, setActiveTab, activeTabId } = useTabs();
      const tab1 = openQueryTab('SELECT 1');
      openQueryTab('SELECT 2');

      setActiveTab(tab1!.id);
      expect(activeTabId.value).toBe(tab1!.id);
    });
  });

  describe('updateTabTitle', () => {
    it('should update the tab title', () => {
      setupActiveConnection();
      const { openQueryTab, updateTabTitle, tabs } = useTabs();
      const tab = openQueryTab('SELECT 1');
      updateTabTitle(tab!.id, 'My Custom Query');

      expect(tabs.value[0].title).toBe('My Custom Query');
    });
  });

  describe('setTabSql', () => {
    it('should set the tab SQL and mark it dirty', () => {
      setupActiveConnection();
      const { openQueryTab, setTabSql, tabs, hasUnsavedChanges } = useTabs();
      const tab = openQueryTab('');
      setTabSql(tab!.id, 'SELECT * FROM users');

      if (tabs.value[0].data.type === TabType.Query) {
        expect(tabs.value[0].data.sql).toBe('SELECT * FROM users');
        expect(tabs.value[0].data.isDirty).toBe(true);
      }
      expect(hasUnsavedChanges.value).toBe(true);
    });
  });

  describe('setTableView', () => {
    it('should toggle table view between data and structure', () => {
      setupActiveConnection();
      const { openTableTab, setTableView, tabs } = useTabs();
      const tab = openTableTab('users');

      if (tabs.value[0].data.type === TabType.Table) {
        expect(tabs.value[0].data.activeView).toBe('data');
      }

      setTableView(tab!.id, 'structure');

      if (tabs.value[0].data.type === TabType.Table) {
        expect(tabs.value[0].data.activeView).toBe('structure');
      }
    });
  });
});
