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
const mockCleanupPendingInitDataForSession = vi.hoisted(() => vi.fn());
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
    cleanupPendingInitDataForSession: mockCleanupPendingInitDataForSession,
  },
}));

import { app, shell, dialog, ipcMain, BrowserWindow } from 'electron';
import { updateThemeFromRenderer, updateWindowState } from '@main/menu';
import { isPathAllowed } from '@main/utils/pathValidation';
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

    it('should throw when filePath is not a string', async () => {
      const handler = getHandler('app:writeFile');
      await expect(handler({}, 123, 'content')).rejects.toThrow('File path must be a non-empty string');
      await expect(handler({}, '', 'content')).rejects.toThrow('File path must be a non-empty string');
    });

    it('should throw when content is not a string', async () => {
      const handler = getHandler('app:writeFile');
      await expect(handler({}, '/tmp/test.sql', 123)).rejects.toThrow('Content must be a string');
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

    it('should throw when filePath is not a string', async () => {
      const handler = getHandler('app:readFile');
      await expect(handler({}, 123)).rejects.toThrow('File path must be a non-empty string');
      await expect(handler({}, '')).rejects.toThrow('File path must be a non-empty string');
      await expect(handler({}, null)).rejects.toThrow('File path must be a non-empty string');
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

    it('should throw when sessionId is not a string', () => {
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({}, 123, 'conn-1')).toThrow('Invalid session ID');
      expect(() => handler({}, '', 'conn-1')).toThrow('Invalid session ID');
      expect(mockOpenNewWindow).not.toHaveBeenCalled();
    });

    it('should throw when savedConnectionId is not a string', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({}, 'session-1', '')).toThrow('Invalid saved connection ID');
      expect(() => handler({}, 'session-1', 123)).toThrow('Invalid saved connection ID');
      expect(mockOpenNewWindow).not.toHaveBeenCalled();
    });

    it('should throw when sender does not own the session', () => {
      mockGetConnection.mockReturnValue({});
      mockGetSessionOwner.mockReturnValueOnce(42); // owned by webContentsId 42
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({ sender: { id: 99 } }, 'session-1', 'conn-1')).toThrow('Not authorized to transfer this session');
      expect(mockOpenNewWindow).not.toHaveBeenCalled();
    });

    it('should allow transfer when sender owns the session', () => {
      mockGetConnection.mockReturnValue({});
      mockGetSessionOwner.mockReturnValueOnce(42);
      const handler = getHandler('app:openInNewWindow');

      handler({ sender: { id: 42 } }, 'session-1', 'conn-1');

      expect(mockOpenNewWindow).toHaveBeenCalled();
    });

    it('should throw when session is already being transferred', () => {
      mockGetConnection.mockReturnValue({});
      mockIsSessionInTransfer.mockReturnValueOnce(true);
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({ sender: { id: 1 } }, 'session-1', 'conn-1')).toThrow('Session is already being transferred');
      expect(mockOpenNewWindow).not.toHaveBeenCalled();
    });

    it('should limit serializedTabs to MAX_SERIALIZED_TABS', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');
      const tooManyTabs = Array.from({ length: 101 }, (_, i) => ({ title: `Tab ${i}` }));

      handler({ sender: { id: 1 } }, 'session-1', 'conn-1', tooManyTabs, 0);

      // Should pass undefined for serializedTabs when exceeding limit
      expect(mockOpenNewWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          adoptSessionId: 'session-1',
          savedConnectionId: 'conn-1',
          serializedTabs: undefined,
        })
      );
    });

    it('should pass valid serializedTabs through', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');
      const tabs = [{ title: 'Tab 1' }, { title: 'Tab 2' }];

      handler({ sender: { id: 1 } }, 'session-1', 'conn-1', tabs, 1);

      expect(mockOpenNewWindow).toHaveBeenCalledWith({
        adoptSessionId: 'session-1',
        savedConnectionId: 'conn-1',
        serializedTabs: tabs,
        activeTabIndex: 1,
      });
    });

    it('should reject non-integer activeTabIndex', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');
      const tabs = [{ title: 'Tab 1' }];

      handler({ sender: { id: 1 } }, 'session-1', 'conn-1', tabs, 1.5);

      expect(mockOpenNewWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTabIndex: undefined,
        })
      );
    });

    it('should reject negative activeTabIndex', () => {
      mockGetConnection.mockReturnValue({});
      const handler = getHandler('app:openInNewWindow');
      const tabs = [{ title: 'Tab 1' }];

      handler({ sender: { id: 1 } }, 'session-1', 'conn-1', tabs, -1);

      expect(mockOpenNewWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTabIndex: undefined,
        })
      );
    });

    it('should clear transfer flag and cleanup when openNewWindow throws', () => {
      mockGetConnection.mockReturnValue({});
      mockOpenNewWindow.mockImplementationOnce(() => { throw new Error('Window creation failed'); });
      const handler = getHandler('app:openInNewWindow');

      expect(() => handler({ sender: { id: 1 } }, 'session-1', 'conn-1')).toThrow('Window creation failed');
      expect(mockClearSessionTransfer).toHaveBeenCalledWith('session-1');
    });

    it('should set a transfer timeout that clears the transfer flag after 30 seconds', () => {
      vi.useFakeTimers();
      mockGetConnection.mockReturnValue({});
      // Return false initially (passes the double-transfer guard), then true for the timeout check
      mockIsSessionInTransfer.mockReturnValueOnce(false).mockReturnValue(true);
      mockGetSessionOwner.mockReturnValue(undefined);
      mockDisconnect.mockResolvedValue(undefined);
      const handler = getHandler('app:openInNewWindow');

      handler({}, 'session-1', 'conn-1');

      expect(mockClearSessionTransfer).not.toHaveBeenCalled();

      // Advance past the 30s timeout
      vi.advanceTimersByTime(30000);

      expect(mockIsSessionInTransfer).toHaveBeenCalledWith('session-1');
      expect(mockClearSessionTransfer).toHaveBeenCalledWith('session-1');
      expect(mockCleanupPendingInitDataForSession).toHaveBeenCalledWith('session-1');
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

    it('should clear transfer flag when session was disconnected before window loaded', () => {
      const initData = { adoptSessionId: 'session-gone', savedConnectionId: 'conn-1' };
      mockConsumePendingInitData.mockReturnValue(initData);
      mockGetConnection.mockReturnValue(undefined); // session no longer exists

      const handler = getHandler('app:getInitData');
      handler({ sender: { id: 42 } });

      expect(mockClearSessionTransfer).toHaveBeenCalledWith('session-gone');
      // Should NOT attempt to transfer session ownership
      expect(mockTransferSession).not.toHaveBeenCalled();
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

  describe('app:openExternal - rejected protocols', () => {
    it('should reject file:// protocol', () => {
      const handler = getHandler('app:openExternal');
      expect(() => handler({}, 'file:///etc/passwd')).toThrow('Only HTTP(S) URLs are allowed');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should reject javascript: protocol', () => {
      const handler = getHandler('app:openExternal');
      expect(() => handler({}, 'javascript:alert(1)')).toThrow('Only HTTP(S) URLs are allowed');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should throw when url is not a string', () => {
      const handler = getHandler('app:openExternal');
      expect(() => handler({}, 123)).toThrow('URL must be a string');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should throw on malformed URL', () => {
      const handler = getHandler('app:openExternal');
      expect(() => handler({}, 'not-a-valid-url')).toThrow('Invalid URL');
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('app:showItemInFolder - disallowed path', () => {
    it('should throw when path is not in an allowed directory', () => {
      vi.mocked(isPathAllowed).mockReturnValueOnce(false);
      const handler = getHandler('app:showItemInFolder');

      expect(() => handler({}, '/etc/secret/data.db')).toThrow('File path is not in an allowed directory');
      expect(shell.showItemInFolder).not.toHaveBeenCalled();
    });
  });

  describe('app:writeFile - disallowed path', () => {
    it('should throw when file path is not in an allowed directory', async () => {
      vi.mocked(isPathAllowed).mockReturnValueOnce(false);
      const handler = getHandler('app:writeFile');

      await expect(handler({}, '/etc/secret/output.sql', 'SELECT 1;')).rejects.toThrow('File path is not in an allowed directory');
      const fs = await import('fs/promises');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('theme:set - invalid theme value', () => {
    it('should throw when theme value is invalid', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow as unknown as Electron.BrowserWindow);

      const handler = getHandler('theme:set');

      expect(() => handler({ sender: {} }, 'invalid')).toThrow('Invalid theme value');
      expect(updateThemeFromRenderer).not.toHaveBeenCalled();
    });
  });

  describe('menu:window-state - non-boolean connected', () => {
    it('should ignore non-boolean connected value', () => {
      const mockWindow = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow as unknown as Electron.BrowserWindow);

      const calls = vi.mocked(ipcMain.on).mock.calls;
      const match = calls.find((c) => c[0] === 'menu:window-state');
      const handler = match![1] as (...args: unknown[]) => void;
      handler({ sender: {} }, 'true');

      expect(updateWindowState).not.toHaveBeenCalled();
    });
  });
});
