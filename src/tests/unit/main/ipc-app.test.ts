import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => {
  const handleMap = new Map<string, (...args: unknown[]) => unknown>();
  return {
    app: {
      getVersion: vi.fn().mockReturnValue('1.2.3'),
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
    },
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/file.db'] }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/export.csv' }),
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handleMap.set(channel, handler);
      }),
    },
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([]),
    },
    __handleMap: handleMap,
  };
});

vi.mock('../../../main/menu', () => ({
  updateThemeFromRenderer: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('file content'),
}));

import { app, shell, dialog, ipcMain, BrowserWindow } from 'electron';
import { updateThemeFromRenderer } from '../../../main/menu';
import { registerAppHandlers } from '../../../main/ipc/app';

// Helper to get the registered handler for a channel
const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls;
  const match = calls.find((c) => c[0] === channel);
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return match[1] as (...args: unknown[]) => unknown;
};

describe('registerAppHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAppHandlers();
  });

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(registeredChannels).toContain('app:getVersion');
    expect(registeredChannels).toContain('app:openExternal');
    expect(registeredChannels).toContain('app:showOpenDialog');
    expect(registeredChannels).toContain('app:showSaveDialog');
    expect(registeredChannels).toContain('app:writeFile');
    expect(registeredChannels).toContain('app:readFile');
    expect(registeredChannels).toContain('theme:set');
  });

  describe('app:getVersion', () => {
    it('should return the app version', () => {
      const handler = getHandler('app:getVersion');
      const result = handler({});
      expect(result).toBe('1.2.3');
      expect(app.getVersion).toHaveBeenCalled();
    });
  });

  describe('app:openExternal', () => {
    it('should call shell.openExternal with the given URL', async () => {
      const handler = getHandler('app:openExternal');
      await handler({}, 'https://example.com');
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('app:showOpenDialog', () => {
    it('should call dialog.showOpenDialog with options', async () => {
      const handler = getHandler('app:showOpenDialog');
      const options = { properties: ['openFile' as const], filters: [{ name: 'DB', extensions: ['db'] }] };
      const result = await handler({}, options);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(options);
      expect(result).toEqual({ canceled: false, filePaths: ['/tmp/file.db'] });
    });
  });

  describe('app:showSaveDialog', () => {
    it('should call dialog.showSaveDialog with options', async () => {
      const handler = getHandler('app:showSaveDialog');
      const options = { defaultPath: 'export.csv' };
      const result = await handler({}, options);
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(options);
      expect(result).toEqual({ canceled: false, filePath: '/tmp/export.csv' });
    });
  });

  describe('app:writeFile', () => {
    it('should write content to a file and return true', async () => {
      const handler = getHandler('app:writeFile');
      const result = await handler({}, '/tmp/output.sql', 'SELECT 1;');
      const fs = await import('fs/promises');
      expect(fs.writeFile).toHaveBeenCalledWith('/tmp/output.sql', 'SELECT 1;', 'utf-8');
      expect(result).toBe(true);
    });
  });

  describe('app:readFile', () => {
    it('should read and return file content', async () => {
      const handler = getHandler('app:readFile');
      const result = await handler({}, '/tmp/input.sql');
      const fs = await import('fs/promises');
      expect(fs.readFile).toHaveBeenCalledWith('/tmp/input.sql', 'utf-8');
      expect(result).toBe('file content');
    });
  });

  describe('theme:set', () => {
    it('should call updateThemeFromRenderer when a main window exists', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

      const handler = getHandler('theme:set');
      handler({}, 'dark');

      expect(updateThemeFromRenderer).toHaveBeenCalledWith('dark', mockWindow);
    });

    it('should not call updateThemeFromRenderer when no windows exist', () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

      const handler = getHandler('theme:set');
      handler({}, 'light');

      expect(updateThemeFromRenderer).not.toHaveBeenCalled();
    });

    it('should handle system theme', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow as unknown as Electron.BrowserWindow]);

      const handler = getHandler('theme:set');
      handler({}, 'system');

      expect(updateThemeFromRenderer).toHaveBeenCalledWith('system', mockWindow);
    });
  });
});
