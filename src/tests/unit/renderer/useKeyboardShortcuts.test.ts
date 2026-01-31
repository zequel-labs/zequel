import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useKeyboardShortcuts, formatShortcut, getAllShortcutsForDisplay } from '@/composables/useKeyboardShortcuts';
import type { KeyboardShortcut } from '@/composables/useKeyboardShortcuts';
import { useTabsStore } from '@/stores/tabs';
import { useConnectionsStore } from '@/stores/connections';

// Mock window.api
vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
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
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  navigator: {
    platform: 'MacIntel',
  },
});

// Override navigator.platform for formatShortcut tests
Object.defineProperty(globalThis, 'navigator', {
  value: { platform: 'MacIntel' },
  writable: true,
  configurable: true,
});

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('shortcuts definition', () => {
    it('should return an array of shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      expect(Array.isArray(shortcuts)).toBe(true);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('should include tab shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const tabShortcuts = shortcuts.filter((s) => s.category === 'tabs');
      expect(tabShortcuts.length).toBeGreaterThan(0);
    });

    it('should include query shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const queryShortcuts = shortcuts.filter((s) => s.category === 'query');
      expect(queryShortcuts.length).toBeGreaterThan(0);
    });

    it('should include navigation shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const navShortcuts = shortcuts.filter((s) => s.category === 'navigation');
      expect(navShortcuts.length).toBeGreaterThan(0);
    });

    it('should include general shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const generalShortcuts = shortcuts.filter((s) => s.category === 'general');
      expect(generalShortcuts.length).toBeGreaterThan(0);
    });

    it('should have Meta+N shortcut for new query tab', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const newTab = shortcuts.find((s) => s.key === 'n' && s.modifiers.includes('meta'));
      expect(newTab).toBeDefined();
      expect(newTab!.description).toBe('New query tab');
      expect(newTab!.global).toBe(true);
    });

    it('should have Meta+W shortcut for close tab', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const closeTab = shortcuts.find((s) => s.key === 'w' && s.modifiers.includes('meta'));
      expect(closeTab).toBeDefined();
      expect(closeTab!.description).toBe('Close current tab');
    });

    it('should have Ctrl+Tab for next tab', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const nextTab = shortcuts.find(
        (s) => s.key === 'Tab' && s.modifiers.includes('ctrl') && !s.modifiers.includes('shift')
      );
      expect(nextTab).toBeDefined();
      expect(nextTab!.description).toBe('Next tab');
    });

    it('should have Ctrl+Shift+Tab for previous tab', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const prevTab = shortcuts.find(
        (s) => s.key === 'Tab' && s.modifiers.includes('ctrl') && s.modifiers.includes('shift')
      );
      expect(prevTab).toBeDefined();
      expect(prevTab!.description).toBe('Previous tab');
    });

    it('should have 9 tab number shortcuts (Meta+1 through Meta+9)', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const numberShortcuts = shortcuts.filter(
        (s) => s.modifiers.includes('meta') && /^[1-9]$/.test(s.key)
      );
      expect(numberShortcuts.length).toBe(9);
    });

    it('should have Meta+S for save query', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const save = shortcuts.find((s) => s.key === 's' && s.modifiers.includes('meta'));
      expect(save).toBeDefined();
      expect(save!.description).toBe('Save current query');
    });

    it('should have Meta+Shift+F for format SQL', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const format = shortcuts.find(
        (s) => s.key === 'f' && s.modifiers.includes('meta') && s.modifiers.includes('shift')
      );
      expect(format).toBeDefined();
      expect(format!.description).toBe('Format SQL');
    });

    it('should have Meta+P for command palette', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const palette = shortcuts.find(
        (s) => s.key === 'p' && s.modifiers.includes('meta') && !s.modifiers.includes('shift')
      );
      expect(palette).toBeDefined();
      expect(palette!.description).toBe('Open command palette');
    });

    it('should have Meta+, for settings', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const settings = shortcuts.find((s) => s.key === ',' && s.modifiers.includes('meta'));
      expect(settings).toBeDefined();
      expect(settings!.description).toBe('Open settings');
    });

    it('should have F1 for keyboard shortcuts', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const help = shortcuts.find((s) => s.key === 'F1' && s.modifiers.length === 0);
      expect(help).toBeDefined();
      expect(help!.description).toBe('Show keyboard shortcuts');
    });

    it('should mark all shortcuts as global', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const nonGlobal = shortcuts.filter((s) => !s.global);
      expect(nonGlobal.length).toBe(0);
    });
  });

  describe('shortcut actions', () => {
    it('should create new query tab on Meta+N when connected', () => {
      const connectionsStore = useConnectionsStore();
      const tabsStore = useTabsStore();
      connectionsStore.activeConnectionId = 'conn-1';

      const { shortcuts } = useKeyboardShortcuts();
      const newTabShortcut = shortcuts.find((s) => s.key === 'n' && s.modifiers.includes('meta'));
      newTabShortcut!.action();

      expect(tabsStore.tabs.length).toBe(1);
    });

    it('should not create tab on Meta+N when not connected', () => {
      const tabsStore = useTabsStore();

      const { shortcuts } = useKeyboardShortcuts();
      const newTabShortcut = shortcuts.find((s) => s.key === 'n' && s.modifiers.includes('meta'));
      newTabShortcut!.action();

      expect(tabsStore.tabs.length).toBe(0);
    });

    it('should close active tab on Meta+W', () => {
      const connectionsStore = useConnectionsStore();
      const tabsStore = useTabsStore();
      connectionsStore.activeConnectionId = 'conn-1';
      const tab = tabsStore.createQueryTab('conn-1', '');

      const { shortcuts } = useKeyboardShortcuts();
      const closeShortcut = shortcuts.find((s) => s.key === 'w' && s.modifiers.includes('meta'));
      closeShortcut!.action();

      expect(tabsStore.tabs.length).toBe(0);
    });

    it('should do nothing on Meta+W when no active tab', () => {
      const tabsStore = useTabsStore();

      const { shortcuts } = useKeyboardShortcuts();
      const closeShortcut = shortcuts.find((s) => s.key === 'w' && s.modifiers.includes('meta'));
      closeShortcut!.action();

      expect(tabsStore.tabs.length).toBe(0);
    });

    it('should dispatch save-query event on Meta+S', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const saveShortcut = shortcuts.find((s) => s.key === 's' && s.modifiers.includes('meta'));
      saveShortcut!.action();

      expect(window.dispatchEvent).toHaveBeenCalled();
      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect(call[0]).toBeInstanceOf(CustomEvent);
      expect((call[0] as CustomEvent).type).toBe('zequel:save-query');
    });

    it('should dispatch format-sql event on Meta+Shift+F', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const formatShortcut = shortcuts.find(
        (s) => s.key === 'f' && s.modifiers.includes('meta') && s.modifiers.includes('shift')
      );
      formatShortcut!.action();

      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect((call[0] as CustomEvent).type).toBe('zequel:format-sql');
    });

    it('should dispatch focus-sidebar-search event on Meta+L', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const focusShortcut = shortcuts.find((s) => s.key === 'l' && s.modifiers.includes('meta'));
      focusShortcut!.action();

      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect((call[0] as CustomEvent).type).toBe('zequel:focus-sidebar-search');
    });

    it('should dispatch toggle-command-palette event on Meta+P', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const paletteShortcut = shortcuts.find(
        (s) => s.key === 'p' && s.modifiers.includes('meta') && !s.modifiers.includes('shift')
      );
      paletteShortcut!.action();

      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect((call[0] as CustomEvent).type).toBe('zequel:toggle-command-palette');
    });

    it('should dispatch open-settings event on Meta+,', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const settingsShortcut = shortcuts.find((s) => s.key === ',' && s.modifiers.includes('meta'));
      settingsShortcut!.action();

      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect((call[0] as CustomEvent).type).toBe('zequel:open-settings');
    });

    it('should dispatch toggle-shortcuts-dialog event on F1', () => {
      const { shortcuts } = useKeyboardShortcuts();
      const helpShortcut = shortcuts.find((s) => s.key === 'F1' && s.modifiers.length === 0);
      helpShortcut!.action();

      const call = vi.mocked(window.dispatchEvent).mock.calls[0];
      expect((call[0] as CustomEvent).type).toBe('zequel:toggle-shortcuts-dialog');
    });

    it('should switch to specific tab on Meta+1 through Meta+9', () => {
      const connectionsStore = useConnectionsStore();
      const tabsStore = useTabsStore();
      connectionsStore.activeConnectionId = 'conn-1';

      // Create 3 tabs
      const tab1 = tabsStore.createQueryTab('conn-1', 'SELECT 1');
      const tab2 = tabsStore.createQueryTab('conn-1', 'SELECT 2');
      const tab3 = tabsStore.createQueryTab('conn-1', 'SELECT 3');

      const { shortcuts } = useKeyboardShortcuts();
      // Press Meta+1 to activate first tab
      const switchTo1 = shortcuts.find((s) => s.key === '1' && s.modifiers.includes('meta'));
      switchTo1!.action();
      expect(tabsStore.activeTabId).toBe(tab1.id);

      // Press Meta+2 to activate second tab
      const switchTo2 = shortcuts.find((s) => s.key === '2' && s.modifiers.includes('meta'));
      switchTo2!.action();
      expect(tabsStore.activeTabId).toBe(tab2.id);

      // Press Meta+3 to activate third tab
      const switchTo3 = shortcuts.find((s) => s.key === '3' && s.modifiers.includes('meta'));
      switchTo3!.action();
      expect(tabsStore.activeTabId).toBe(tab3.id);
    });

    it('should not crash when switching to non-existent tab number', () => {
      const tabsStore = useTabsStore();
      tabsStore.createQueryTab('conn-1', '');

      const { shortcuts } = useKeyboardShortcuts();
      // Tab 9 does not exist
      const switchTo9 = shortcuts.find((s) => s.key === '9' && s.modifiers.includes('meta'));
      expect(() => switchTo9!.action()).not.toThrow();
    });
  });

  describe('tab navigation', () => {
    it('should navigate to next tab with Meta+]', () => {
      const tabsStore = useTabsStore();
      const tab1 = tabsStore.createQueryTab('conn-1', '');
      const tab2 = tabsStore.createQueryTab('conn-1', '');
      tabsStore.setActiveTab(tab1.id);

      const { shortcuts } = useKeyboardShortcuts();
      const nextTab = shortcuts.find((s) => s.key === ']' && s.modifiers.includes('meta'));
      nextTab!.action();

      expect(tabsStore.activeTabId).toBe(tab2.id);
    });

    it('should wrap around to first tab when at the end', () => {
      const tabsStore = useTabsStore();
      const tab1 = tabsStore.createQueryTab('conn-1', '');
      const tab2 = tabsStore.createQueryTab('conn-1', '');
      tabsStore.setActiveTab(tab2.id);

      const { shortcuts } = useKeyboardShortcuts();
      const nextTab = shortcuts.find((s) => s.key === ']' && s.modifiers.includes('meta'));
      nextTab!.action();

      expect(tabsStore.activeTabId).toBe(tab1.id);
    });

    it('should navigate to previous tab with Meta+[', () => {
      const tabsStore = useTabsStore();
      const tab1 = tabsStore.createQueryTab('conn-1', '');
      const tab2 = tabsStore.createQueryTab('conn-1', '');
      tabsStore.setActiveTab(tab2.id);

      const { shortcuts } = useKeyboardShortcuts();
      const prevTab = shortcuts.find((s) => s.key === '[' && s.modifiers.includes('meta'));
      prevTab!.action();

      expect(tabsStore.activeTabId).toBe(tab1.id);
    });

    it('should wrap around to last tab when at the beginning', () => {
      const tabsStore = useTabsStore();
      const tab1 = tabsStore.createQueryTab('conn-1', '');
      const tab2 = tabsStore.createQueryTab('conn-1', '');
      tabsStore.setActiveTab(tab1.id);

      const { shortcuts } = useKeyboardShortcuts();
      const prevTab = shortcuts.find((s) => s.key === '[' && s.modifiers.includes('meta'));
      prevTab!.action();

      expect(tabsStore.activeTabId).toBe(tab2.id);
    });
  });

  describe('register and unregister', () => {
    it('should register keydown listener', () => {
      const { register } = useKeyboardShortcuts();
      register();

      expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });

    it('should unregister keydown listener', () => {
      const { register, unregister } = useKeyboardShortcuts();
      register();
      unregister();

      expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });
  });

  describe('handleKeyDown', () => {
    const createKeyboardEvent = (
      key: string,
      options: {
        metaKey?: boolean;
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        target?: Partial<HTMLElement>;
      } = {}
    ): KeyboardEvent => {
      const target = {
        tagName: 'DIV',
        closest: vi.fn().mockReturnValue(null),
        ...options.target,
      };
      const event = {
        key,
        metaKey: options.metaKey ?? false,
        ctrlKey: options.ctrlKey ?? false,
        shiftKey: options.shiftKey ?? false,
        altKey: options.altKey ?? false,
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };
      return event as unknown as KeyboardEvent;
    };

    it('should handle Meta+N keypress', () => {
      const connectionsStore = useConnectionsStore();
      const tabsStore = useTabsStore();
      connectionsStore.activeConnectionId = 'conn-1';

      const { register } = useKeyboardShortcuts();
      register();

      // Get the registered handler
      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('n', { metaKey: true });
      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(tabsStore.tabs.length).toBe(1);
    });

    it('should handle F1 keypress (no modifiers)', () => {
      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('F1', {});
      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('should not trigger F1 when meta is held', () => {
      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('F1', { metaKey: true });
      handler(event);

      // F1 requires no modifiers, so with metaKey it should NOT trigger
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should execute global shortcuts even when in an input field', () => {
      const connectionsStore = useConnectionsStore();
      connectionsStore.activeConnectionId = 'conn-1';

      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('n', {
        metaKey: true,
        target: { tagName: 'INPUT', closest: vi.fn().mockReturnValue(null) },
      });
      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should execute global shortcuts even when in Monaco editor', () => {
      const connectionsStore = useConnectionsStore();
      connectionsStore.activeConnectionId = 'conn-1';

      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('n', {
        metaKey: true,
        target: {
          tagName: 'DIV',
          closest: vi.fn().mockImplementation((selector: string) =>
            selector === '.monaco-editor' ? {} : null
          ),
        },
      });
      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not trigger when key does not match any shortcut', () => {
      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('z', { metaKey: true });
      handler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should match ? key via / key with shift', () => {
      const { register } = useKeyboardShortcuts();
      register();

      const handler = vi.mocked(window.addEventListener).mock.calls.find(
        (c) => c[0] === 'keydown'
      )![1] as EventListener;

      const event = createKeyboardEvent('/', { metaKey: true, shiftKey: true });
      handler(event);

      // The ? shortcut should match when / is pressed with shift
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});

describe('formatShortcut', () => {
  beforeEach(() => {
    // Set platform to Mac
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });
  });

  it('should format Mac meta modifier', () => {
    const result = formatShortcut(['meta'], 'n');
    expect(result).toContain('\u2318');
    expect(result).toContain('N');
  });

  it('should format Mac shift modifier', () => {
    const result = formatShortcut(['shift'], 'f');
    expect(result).toContain('\u21E7');
  });

  it('should format Mac alt modifier', () => {
    const result = formatShortcut(['alt'], 'a');
    expect(result).toContain('\u2325');
  });

  it('should format Mac ctrl modifier', () => {
    const result = formatShortcut(['ctrl'], 'Tab');
    expect(result).toContain('\u2303');
  });

  it('should format multiple modifiers', () => {
    const result = formatShortcut(['meta', 'shift'], 'f');
    expect(result).toContain('\u2318');
    expect(result).toContain('\u21E7');
  });

  it('should format Tab key as symbol', () => {
    const result = formatShortcut(['ctrl'], 'Tab');
    expect(result).toContain('\u21E5');
  });

  it('should format Enter key as symbol', () => {
    const result = formatShortcut(['meta'], 'Enter');
    expect(result).toContain('\u21A9');
  });

  it('should format Escape key', () => {
    const result = formatShortcut([], 'Escape');
    expect(result).toBe('Esc');
  });

  it('should format ? key', () => {
    const result = formatShortcut(['meta', 'shift'], '?');
    expect(result).toContain('?');
  });

  it('should format , key', () => {
    const result = formatShortcut(['meta'], ',');
    expect(result).toContain(',');
  });

  it('should format Space key', () => {
    const result = formatShortcut(['meta'], ' ');
    expect(result).toContain('Space');
  });

  it('should format F-keys preserving casing', () => {
    const result = formatShortcut([], 'F1');
    expect(result).toBe('F1');
  });

  it('should uppercase regular keys', () => {
    const result = formatShortcut(['meta'], 'n');
    expect(result).toContain('N');
  });

  it('should format Windows-style modifiers on non-Mac', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    const result = formatShortcut(['meta', 'shift'], 'f');
    expect(result).toContain('Ctrl');
    expect(result).toContain('Shift');
    expect(result).toContain('+');
  });
});

describe('getAllShortcutsForDisplay', () => {
  it('should return an array of shortcuts', () => {
    const shortcuts = getAllShortcutsForDisplay();
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(shortcuts.length).toBeGreaterThan(0);
  });

  it('should include all categories', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const categories = new Set(shortcuts.map((s) => s.category));
    expect(categories.has('tabs')).toBe(true);
    expect(categories.has('query')).toBe(true);
    expect(categories.has('navigation')).toBe(true);
    expect(categories.has('general')).toBe(true);
    expect(categories.has('editor')).toBe(true);
  });

  it('should deduplicate shortcuts with the same category and description', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const ids = shortcuts.map((s) => `${s.category}:${s.description}`);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should include editor shortcuts', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const editorShortcuts = shortcuts.filter((s) => s.category === 'editor');
    expect(editorShortcuts.length).toBeGreaterThan(0);
  });

  it('should include execute query editor shortcut', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const execShortcut = shortcuts.find((s) => s.description === 'Execute query');
    expect(execShortcut).toBeDefined();
    expect(execShortcut!.category).toBe('editor');
  });

  it('should include format SQL editor shortcut', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const formatShortcut = shortcuts.find((s) => s.description === 'Format SQL (in editor)');
    expect(formatShortcut).toBeDefined();
    expect(formatShortcut!.category).toBe('editor');
  });

  it('should consolidate tab 1-9 into a single entry', () => {
    const shortcuts = getAllShortcutsForDisplay();
    const tabSwitch = shortcuts.filter((s) => s.description.startsWith('Switch to tab'));
    expect(tabSwitch.length).toBe(1);
    expect(tabSwitch[0].description).toBe('Switch to tab 1-9');
  });
});
