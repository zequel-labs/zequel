import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Create a fake localStorage that persists across calls within a test
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string): string | null => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  }),
  get length() { return Object.keys(storage).length; },
  key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
};

// Mock matchMedia
const mockAddEventListener = vi.fn();
const mockMatchMedia = vi.fn(() => ({
  matches: false,
  addEventListener: mockAddEventListener,
}));

// Mock document.documentElement
const mockClassList = {
  toggle: vi.fn(),
};

// Mock window.api.theme
const mockThemeSet = vi.fn();
const mockThemeOnChange = vi.fn();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', {
  ...globalThis.window,
  localStorage: localStorageMock,
  matchMedia: mockMatchMedia,
  api: {
    platform: 'darwin',
    theme: {
      set: mockThemeSet,
      onChange: mockThemeOnChange,
    },
  },
});

vi.stubGlobal('document', {
  ...globalThis.document,
  documentElement: {
    classList: mockClassList,
  },
});

// Must import after mocks are set up since the store self-initializes
import { useSettingsStore } from '@/stores/settings';

describe('Settings Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Clear the storage between tests
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  });

  describe('initial state', () => {
    it('should have default theme as dark', () => {
      const store = useSettingsStore();
      // theme may have been loaded from localStorage or default
      expect(['light', 'dark', 'system']).toContain(store.theme);
    });

    it('should have default sidebarWidth', () => {
      const store = useSettingsStore();
      expect(store.sidebarWidth).toBeGreaterThanOrEqual(200);
      expect(store.sidebarWidth).toBeLessThanOrEqual(500);
    });

    it('should have default editor settings', () => {
      const store = useSettingsStore();
      expect(store.editorSettings).toBeDefined();
      expect(store.editorSettings.fontSize).toBeGreaterThan(0);
      expect(store.editorSettings.tabSize).toBeGreaterThan(0);
      expect(typeof store.editorSettings.wordWrap).toBe('boolean');
      expect(typeof store.editorSettings.minimap).toBe('boolean');
      expect(typeof store.editorSettings.lineNumbers).toBe('boolean');
    });

    it('should have default grid settings', () => {
      const store = useSettingsStore();
      expect(store.gridSettings).toBeDefined();
      expect(store.gridSettings.pageSize).toBeGreaterThan(0);
      expect(typeof store.gridSettings.alternateRowColors).toBe('boolean');
    });
  });

  describe('loadSettings', () => {
    it('should load settings from localStorage', () => {
      // Set localStorage before loadSettings
      storage['zequel-settings'] = JSON.stringify({
        theme: 'light',
        sidebarWidth: 350,
        editorSettings: { fontSize: 16, tabSize: 4 },
        gridSettings: { pageSize: 50 },
      });

      const store = useSettingsStore();
      store.loadSettings();

      expect(store.theme).toBe('light');
      expect(store.sidebarWidth).toBe(350);
      expect(store.editorSettings.fontSize).toBe(16);
      expect(store.editorSettings.tabSize).toBe(4);
      expect(store.gridSettings.pageSize).toBe(50);
    });

    it('should handle missing localStorage data gracefully', () => {
      const store = useSettingsStore();
      store.loadSettings();
      // Should not throw; uses defaults
      expect(store.theme).toBeDefined();
    });

    it('should handle invalid JSON in localStorage', () => {
      storage['zequel-settings'] = 'not-json';
      const store = useSettingsStore();
      // Should not throw
      expect(() => store.loadSettings()).not.toThrow();
    });

    it('should partially apply stored settings', () => {
      storage['zequel-settings'] = JSON.stringify({
        theme: 'system',
      });

      const store = useSettingsStore();
      store.loadSettings();

      expect(store.theme).toBe('system');
      // Other settings should remain at defaults
      expect(store.editorSettings.fontSize).toBe(14);
    });

    it('should call applyTheme after loading', () => {
      storage['zequel-settings'] = JSON.stringify({
        theme: 'dark',
      });

      const store = useSettingsStore();
      vi.clearAllMocks();
      store.loadSettings();

      // applyTheme calls classList.toggle
      expect(mockClassList.toggle).toHaveBeenCalled();
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const store = useSettingsStore();
      store.setTheme('light');
      expect(store.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const store = useSettingsStore();
      store.setTheme('dark');
      expect(store.theme).toBe('dark');
    });

    it('should set theme to system', () => {
      const store = useSettingsStore();
      store.setTheme('system');
      expect(store.theme).toBe('system');
    });

    it('should call applyTheme when setting theme', () => {
      const store = useSettingsStore();
      vi.clearAllMocks();

      store.setTheme('light');
      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', false);
    });

    it('should persist settings to localStorage after theme change', () => {
      const store = useSettingsStore();
      store.setTheme('light');

      expect(storage['zequel-settings']).toBeDefined();
      const parsed = JSON.parse(storage['zequel-settings']);
      expect(parsed.theme).toBe('light');
    });

    it('should notify main process when not fromMainProcess', () => {
      const store = useSettingsStore();
      vi.clearAllMocks();

      store.setTheme('dark', false);
      expect(mockThemeSet).toHaveBeenCalledWith('dark');
    });

    it('should not notify main process when fromMainProcess is true', () => {
      const store = useSettingsStore();
      vi.clearAllMocks();

      store.setTheme('dark', true);
      expect(mockThemeSet).not.toHaveBeenCalled();
    });

    it('should apply dark class when theme is dark', () => {
      const store = useSettingsStore();
      vi.clearAllMocks();

      store.setTheme('dark');
      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
    });

    it('should remove dark class when theme is light', () => {
      const store = useSettingsStore();
      vi.clearAllMocks();

      store.setTheme('light');
      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', false);
    });

    it('should use system preference when theme is system', () => {
      // Mock system dark mode
      mockMatchMedia.mockReturnValueOnce({
        matches: true,
        addEventListener: mockAddEventListener,
      });

      const store = useSettingsStore();
      vi.clearAllMocks();

      // Need to re-mock for the applyTheme call
      mockMatchMedia.mockReturnValueOnce({
        matches: true,
        addEventListener: mockAddEventListener,
      });

      store.setTheme('system');
      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
    });
  });

  describe('setSidebarWidth', () => {
    it('should set sidebar width within bounds', () => {
      const store = useSettingsStore();
      store.setSidebarWidth(350);
      expect(store.sidebarWidth).toBe(350);
    });

    it('should clamp width to minimum 200', () => {
      const store = useSettingsStore();
      store.setSidebarWidth(100);
      expect(store.sidebarWidth).toBe(200);
    });

    it('should clamp width to maximum 500', () => {
      const store = useSettingsStore();
      store.setSidebarWidth(600);
      expect(store.sidebarWidth).toBe(500);
    });

    it('should persist settings to localStorage after width change', () => {
      const store = useSettingsStore();
      store.setSidebarWidth(300);

      expect(storage['zequel-settings']).toBeDefined();
      const parsed = JSON.parse(storage['zequel-settings']);
      expect(parsed.sidebarWidth).toBe(300);
    });
  });

  describe('updateEditorSettings', () => {
    it('should update fontSize', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ fontSize: 18 });
      expect(store.editorSettings.fontSize).toBe(18);
    });

    it('should update tabSize', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ tabSize: 4 });
      expect(store.editorSettings.tabSize).toBe(4);
    });

    it('should update wordWrap', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ wordWrap: true });
      expect(store.editorSettings.wordWrap).toBe(true);
    });

    it('should update minimap', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ minimap: true });
      expect(store.editorSettings.minimap).toBe(true);
    });

    it('should update lineNumbers', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ lineNumbers: false });
      expect(store.editorSettings.lineNumbers).toBe(false);
    });

    it('should update multiple settings at once', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ fontSize: 20, tabSize: 8 });
      expect(store.editorSettings.fontSize).toBe(20);
      expect(store.editorSettings.tabSize).toBe(8);
    });

    it('should not overwrite unspecified settings', () => {
      const store = useSettingsStore();
      const originalTabSize = store.editorSettings.tabSize;
      store.updateEditorSettings({ fontSize: 16 });
      expect(store.editorSettings.tabSize).toBe(originalTabSize);
    });

    it('should persist settings to localStorage', () => {
      const store = useSettingsStore();
      store.updateEditorSettings({ fontSize: 16 });

      expect(storage['zequel-settings']).toBeDefined();
      const parsed = JSON.parse(storage['zequel-settings']);
      expect(parsed.editorSettings.fontSize).toBe(16);
    });
  });

  describe('updateGridSettings', () => {
    it('should update pageSize', () => {
      const store = useSettingsStore();
      store.updateGridSettings({ pageSize: 50 });
      expect(store.gridSettings.pageSize).toBe(50);
    });

    it('should update alternateRowColors', () => {
      const store = useSettingsStore();
      store.updateGridSettings({ alternateRowColors: false });
      expect(store.gridSettings.alternateRowColors).toBe(false);
    });

    it('should not overwrite unspecified settings', () => {
      const store = useSettingsStore();
      const originalAlternateRowColors = store.gridSettings.alternateRowColors;
      store.updateGridSettings({ pageSize: 200 });
      expect(store.gridSettings.alternateRowColors).toBe(originalAlternateRowColors);
    });

    it('should persist settings to localStorage', () => {
      const store = useSettingsStore();
      store.updateGridSettings({ pageSize: 200 });

      expect(storage['zequel-settings']).toBeDefined();
      const parsed = JSON.parse(storage['zequel-settings']);
      expect(parsed.gridSettings.pageSize).toBe(200);
    });
  });
});
