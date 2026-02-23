import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.hoisted(() => vi.fn(() => true));
const mockGetConnection = vi.hoisted(() => vi.fn());
const mockConsumePendingInitData = vi.hoisted(() => vi.fn());
const mockOpenNewWindow = vi.hoisted(() => vi.fn());
const mockTransferSession = vi.hoisted(() => vi.fn());
const mockRemoveSessionOwner = vi.hoisted(() => vi.fn());
const mockMarkSessionInTransfer = vi.hoisted(() => vi.fn());
const mockClearSessionTransfer = vi.hoisted(() => vi.fn());
const mockIsSessionInTransfer = vi.hoisted(() => vi.fn());
const mockGetSessionOwner = vi.hoisted(() => vi.fn());
const mockDisconnect = vi.hoisted(() => vi.fn());

// Mock electron modules
vi.mock('electron', () => {
  const handleMap = new Map<string, (...args: unknown[]) => unknown>();
  return {
    app: {
      getVersion: vi.fn().mockReturnValue('1.2.3'),
      getPath: vi.fn().mockReturnValue('/tmp'),
      isPackaged: false,
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
      showItemInFolder: vi.fn(),
      openPath: vi.fn().mockResolvedValue(''),
    },
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/file.db'] }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/export.csv' }),
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handleMap.set(channel, handler);
      }),
      on: vi.fn(),
    },
    BrowserWindow: {
      getAllWindows: vi.fn().mockReturnValue([]),
      fromWebContents: vi.fn().mockReturnValue(null),
    },
    __handleMap: handleMap,
  };
});

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('@main/utils/pathValidation', () => ({
  isPathAllowed: vi.fn(() => true),
}));

vi.mock('@main/menu', () => ({
  updateThemeFromRenderer: vi.fn(),
  updateWindowState: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('file content'),
}));

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: mockGetConnection,
    disconnect: mockDisconnect,
  },
}));

vi.mock('@main/services/windowManager', () => ({
  windowManager: {
    consumePendingInitData: mockConsumePendingInitData,
    openNewWindow: mockOpenNewWindow,
    transferSession: mockTransferSession,
    removeSessionOwner: mockRemoveSessionOwner,
    markSessionInTransfer: mockMarkSessionInTransfer,
    clearSessionTransfer: mockClearSessionTransfer,
    isSessionInTransfer: mockIsSessionInTransfer,
    getSessionOwner: mockGetSessionOwner,
  },
}));

import { app, shell, dialog, ipcMain, BrowserWindow } from 'electron';
import { updateThemeFromRenderer, updateWindowState } from '@main/menu';
import { registerAppHandlers } from '@main/ipc/app';

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
    expect(registeredChannels).toContain('app:showItemInFolder');
    expect(registeredChannels).toContain('app:showOpenDialog');
    expect(registeredChannels).toContain('app:showSaveDialog');
    expect(registeredChannels).toContain('app:writeFile');
    expect(registeredChannels).toContain('app:readFile');
    expect(registeredChannels).toContain('theme:set');
    expect(registeredChannels).toContain('app:openInNewWindow');
    expect(registeredChannels).toContain('app:getInitData');
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

  describe('app:showItemInFolder', () => {
    it('should call shell.showItemInFolder when file exists', () => {
      mockExistsSync.mockReturnValue(true);
      const handler = getHandler('app:showItemInFolder');
      handler({}, '/tmp/backup.sql');
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/backup.sql');
    });

    it('should try .zip fallback when original file does not exist', () => {
      mockExistsSync.mockImplementation((p: string) => p === '/tmp/backup.zip');
      const handler = getHandler('app:showItemInFolder');
      handler({}, '/tmp/backup.sql');
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/backup.zip');
    });

    it('should open parent directory when neither original nor .zip exists', () => {
      mockExistsSync.mockReturnValue(false);
      const handler = getHandler('app:showItemInFolder');
      handler({}, '/tmp/backup.sql');
      expect(shell.showItemInFolder).not.toHaveBeenCalled();
      expect(shell.openPath).toHaveBeenCalledWith('/tmp');
    });

    it('should handle file without extension', () => {
      mockExistsSync.mockImplementation((p: string) => p === '/tmp/mongodump.zip');
      const handler = getHandler('app:showItemInFolder');
      handler({}, '/tmp/mongodump');
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/mongodump.zip');
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
    it('should call updateThemeFromRenderer when sender window exists', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow as unknown as Electron.BrowserWindow);

      const handler = getHandler('theme:set');
      handler({ sender: {} }, 'dark');

      expect(updateThemeFromRenderer).toHaveBeenCalledWith('dark', mockWindow);
    });

    it('should not call updateThemeFromRenderer when sender window is null', () => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);

      const handler = getHandler('theme:set');
      handler({ sender: {} }, 'light');

      expect(updateThemeFromRenderer).not.toHaveBeenCalled();
    });

    it('should handle system theme', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow as unknown as Electron.BrowserWindow);

      const handler = getHandler('theme:set');
      handler({ sender: {} }, 'system');

      expect(updateThemeFromRenderer).toHaveBeenCalledWith('system', mockWindow);
    });
  });

  describe('menu:window-state', () => {
    it('should register the menu:window-state handler via ipcMain.on', () => {
      const calls = vi.mocked(ipcMain.on).mock.calls;
      const match = calls.find((c) => c[0] === 'menu:window-state');
      expect(match).toBeTruthy();
    });

    it('should call updateWindowState when sender window exists', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow as unknown as Electron.BrowserWindow);

      const calls = vi.mocked(ipcMain.on).mock.calls;
      const match = calls.find((c) => c[0] === 'menu:window-state');
      const handler = match![1] as (...args: unknown[]) => void;
      handler({ sender: {} }, true);

      expect(updateWindowState).toHaveBeenCalledWith(true, mockWindow);
    });

    it('should not call updateWindowState when sender window is null', () => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);

      const calls = vi.mocked(ipcMain.on).mock.calls;
      const match = calls.find((c) => c[0] === 'menu:window-state');
      const handler = match![1] as (...args: unknown[]) => void;
      handler({ sender: {} }, false);

      expect(updateWindowState).not.toHaveBeenCalled();
    });
  });

  describe('app:openInNewWindow', () => {
    it('should open a new window with init data when session exists', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');

      handler({}, 'session-1', 'conn-1');

      expect(mockOpenNewWindow).toHaveBeenCalledWith({
        adoptSessionId: 'session-1',
        savedConnectionId: 'conn-1',
      });
    });

    it('should throw when session does not exist', () => {
      mockGetConnection.mockReturnValue(undefined);
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({}, 'session-999', 'conn-1')).toThrow('Session session-999 not found');
      expect(mockOpenNewWindow).not.toHaveBeenCalled();
    });

    it('should call markSessionInTransfer instead of removeSessionOwner', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');

      handler({}, 'session-1', 'conn-1');

      expect(mockMarkSessionInTransfer).toHaveBeenCalledWith('session-1');
      expect(mockRemoveSessionOwner).not.toHaveBeenCalled();
    });

    it('should set a transfer timeout that clears the transfer flag after 30 seconds', () => {
      vi.useFakeTimers();
      mockGetConnection.mockReturnValue({});
      mockIsSessionInTransfer.mockReturnValue(true);
      mockGetSessionOwner.mockReturnValue(undefined);
      mockDisconnect.mockResolvedValue(undefined);
      const handler = getHandler('app:openInNewWindow');

      handler({}, 'session-1', 'conn-1');

      expect(mockClearSessionTransfer).not.toHaveBeenCalled();

      // Advance past the 30s timeout
      vi.advanceTimersByTime(30000);

      expect(mockIsSessionInTransfer).toHaveBeenCalledWith('session-1');
      expect(mockClearSessionTransfer).toHaveBeenCalledWith('session-1');
      // Session has no owner, so it should be disconnected to prevent orphan
      expect(mockGetSessionOwner).toHaveBeenCalledWith('session-1');
      expect(mockDisconnect).toHaveBeenCalledWith('session-1');

      vi.useRealTimers();
    });

    it('should not clear transfer flag if session was already transferred before timeout', () => {
      vi.useFakeTimers();
      mockGetConnection.mockReturnValue({});
      mockIsSessionInTransfer.mockReturnValue(false);
      const handler = getHandler('app:openInNewWindow');

      handler({}, 'session-1', 'conn-1');

      vi.advanceTimersByTime(30000);

      expect(mockIsSessionInTransfer).toHaveBeenCalledWith('session-1');
      expect(mockClearSessionTransfer).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('app:getInitData', () => {
    it('should consume and return pending init data for the sender', () => {
      const initData = { adoptSessionId: 'session-1', savedConnectionId: 'conn-1' };
      mockConsumePendingInitData.mockReturnValue(initData);
      mockGetConnection.mockReturnValue({});

      const handler = getHandler('app:getInitData');
      const result = handler({ sender: { id: 42 } });

      expect(mockConsumePendingInitData).toHaveBeenCalledWith(42);
      expect(result).toEqual(initData);
    });

    it('should return null when no pending init data exists', () => {
      mockConsumePendingInitData.mockReturnValue(null);

      const handler = getHandler('app:getInitData');
      const result = handler({ sender: { id: 99 } });

      expect(result).toBeNull();
    });

    it('should return null when session was disconnected before window loaded', () => {
      const initData = { adoptSessionId: 'session-gone', savedConnectionId: 'conn-1' };
      mockConsumePendingInitData.mockReturnValue(initData);
      mockGetConnection.mockReturnValue(undefined); // session no longer exists

      const handler = getHandler('app:getInitData');
      const result = handler({ sender: { id: 42 } });

      expect(mockConsumePendingInitData).toHaveBeenCalledWith(42);
      expect(result).toBeNull();
    });

    it('should transfer session ownership on successful getInitData', () => {
      const initData = { adoptSessionId: 'session-1', savedConnectionId: 'conn-1' };
      mockConsumePendingInitData.mockReturnValue(initData);
      mockGetConnection.mockReturnValue({});

      const handler = getHandler('app:getInitData');
      handler({ sender: { id: 42 } });

      expect(mockTransferSession).toHaveBeenCalledWith('session-1', 42);
    });
  });
});
