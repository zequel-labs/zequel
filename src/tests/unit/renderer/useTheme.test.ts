import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTheme } from '@/composables/useTheme';
import { useSettingsStore } from '@/stores/settings';
import type { Theme } from '@/stores/settings';

// Mock document.documentElement for theme application
const mockClassList = {
  toggle: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  contains: vi.fn(),
};

vi.stubGlobal('document', {
  documentElement: {
    classList: mockClassList,
  },
});

// Mock window.api and related browser APIs
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
  dispatchEvent: vi.fn(),
});

describe('useTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have a theme value', () => {
      const { theme } = useTheme();
      expect(theme.value).toBeDefined();
      // Default from settings store is 'dark'
      expect(theme.value).toBe('dark');
    });

    it('should report isDark as true for dark theme', () => {
      const { isDark } = useTheme();
      // Default theme is 'dark'
      expect(isDark.value).toBe(true);
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const { setTheme, theme, isDark } = useTheme();
      setTheme('light');

      expect(theme.value).toBe('light');
      expect(isDark.value).toBe(false);
    });

    it('should set theme to dark', () => {
      const { setTheme, theme, isDark } = useTheme();
      setTheme('light');
      setTheme('dark');

      expect(theme.value).toBe('dark');
      expect(isDark.value).toBe(true);
    });

    it('should set theme to system', () => {
      const { setTheme, theme } = useTheme();
      setTheme('system');

      expect(theme.value).toBe('system');
    });

    it('should detect system dark preference when theme is system', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      const { setTheme, isDark } = useTheme();
      setTheme('system');

      expect(isDark.value).toBe(true);
    });

    it('should detect system light preference when theme is system', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      const { setTheme, isDark } = useTheme();
      setTheme('system');

      expect(isDark.value).toBe(false);
    });

    it('should persist theme to settings store', () => {
      const settingsStore = useSettingsStore();
      const { setTheme } = useTheme();
      setTheme('light');

      expect(settingsStore.theme).toBe('light');
    });

    it('should call settings store setTheme', () => {
      const settingsStore = useSettingsStore();
      const spy = vi.spyOn(settingsStore, 'setTheme');

      const { setTheme } = useTheme();
      setTheme('dark');

      expect(spy).toHaveBeenCalledWith('dark');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const { toggleTheme, theme } = useTheme();
      // Default is 'dark'
      expect(theme.value).toBe('dark');

      toggleTheme();
      expect(theme.value).toBe('light');
    });

    it('should toggle from light to dark', () => {
      const { setTheme, toggleTheme, theme } = useTheme();
      setTheme('light');
      expect(theme.value).toBe('light');

      toggleTheme();
      expect(theme.value).toBe('dark');
    });

    it('should toggle from system to dark', () => {
      const { setTheme, toggleTheme, theme } = useTheme();
      setTheme('system');
      expect(theme.value).toBe('system');

      // When theme is 'system', it is not 'dark', so toggleTheme sets to 'dark'
      toggleTheme();
      expect(theme.value).toBe('dark');
    });
  });

  describe('isDark computed', () => {
    it('should be true when theme is dark', () => {
      const { setTheme, isDark } = useTheme();
      setTheme('dark');
      expect(isDark.value).toBe(true);
    });

    it('should be false when theme is light', () => {
      const { setTheme, isDark } = useTheme();
      setTheme('light');
      expect(isDark.value).toBe(false);
    });

    it('should follow system preference when theme is system', () => {
      // System prefers dark
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      const { setTheme, isDark } = useTheme();
      setTheme('system');
      expect(isDark.value).toBe(true);

      // System prefers light
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      // Need to re-read computed
      const theme2 = useTheme();
      expect(theme2.isDark.value).toBe(false);
    });
  });

  describe('theme reactivity', () => {
    it('should update theme computed when settings store changes', () => {
      const settingsStore = useSettingsStore();
      const { theme } = useTheme();

      expect(theme.value).toBe('dark');
      settingsStore.setTheme('light');
      expect(theme.value).toBe('light');
    });

    it('should update isDark computed when settings store changes', () => {
      const settingsStore = useSettingsStore();
      const { isDark } = useTheme();

      expect(isDark.value).toBe(true);
      settingsStore.setTheme('light');
      expect(isDark.value).toBe(false);
    });
  });

  describe('theme applies to document', () => {
    it('should apply dark class for dark theme', () => {
      const { setTheme } = useTheme();
      setTheme('dark');

      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
    });

    it('should remove dark class for light theme', () => {
      const { setTheme } = useTheme();
      setTheme('light');

      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', false);
    });

    it('should apply system preference dark class', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      const { setTheme } = useTheme();
      setTheme('system');

      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
    });

    it('should apply system preference light class', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);

      const { setTheme } = useTheme();
      setTheme('system');

      expect(mockClassList.toggle).toHaveBeenCalledWith('dark', false);
    });
  });

  describe('theme persistence', () => {
    it('should sync theme to main process via window.api.theme.set', () => {
      const { setTheme } = useTheme();
      setTheme('light');

      expect(window.api.theme.set).toHaveBeenCalledWith('light');
    });

    it('should sync dark theme to main process', () => {
      const { setTheme } = useTheme();
      setTheme('light');
      vi.clearAllMocks();

      setTheme('dark');
      expect(window.api.theme.set).toHaveBeenCalledWith('dark');
    });

    it('should sync system theme to main process', () => {
      const { setTheme } = useTheme();
      vi.clearAllMocks();

      setTheme('system');
      expect(window.api.theme.set).toHaveBeenCalledWith('system');
    });
  });

  describe('all theme values', () => {
    const themes: Theme[] = ['light', 'dark', 'system'];

    themes.forEach((themeValue) => {
      it(`should accept "${themeValue}" as a valid theme`, () => {
        const { setTheme, theme } = useTheme();
        setTheme(themeValue);
        expect(theme.value).toBe(themeValue);
      });
    });
  });
});
