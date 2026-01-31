import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIpcHandle } = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

vi.mock('@main/services/autoUpdater', () => ({
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

import { registerUpdaterHandlers } from '@main/ipc/updater';
import { checkForUpdates, downloadUpdate, installUpdate } from '@main/services/autoUpdater';

const mockCheckForUpdates = vi.mocked(checkForUpdates);
const mockDownloadUpdate = vi.mocked(downloadUpdate);
const mockInstallUpdate = vi.mocked(installUpdate);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerUpdaterHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerUpdaterHandlers();
  });

  it('should register all updater IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'updater:check',
      'updater:download',
      'updater:install',
    ]);
  });

  describe('updater:check', () => {
    it('should call checkForUpdates', async () => {
      mockCheckForUpdates.mockResolvedValue(undefined);

      const handler = getHandler('updater:check');
      await handler(null);

      expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it('should propagate errors from checkForUpdates', async () => {
      mockCheckForUpdates.mockRejectedValue(new Error('Network error'));

      const handler = getHandler('updater:check');
      await expect(handler(null)).rejects.toThrow('Network error');
    });
  });

  describe('updater:download', () => {
    it('should call downloadUpdate', async () => {
      mockDownloadUpdate.mockResolvedValue(undefined);

      const handler = getHandler('updater:download');
      await handler(null);

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });

    it('should propagate errors from downloadUpdate', async () => {
      mockDownloadUpdate.mockRejectedValue(new Error('Disk full'));

      const handler = getHandler('updater:download');
      await expect(handler(null)).rejects.toThrow('Disk full');
    });
  });

  describe('updater:install', () => {
    it('should call installUpdate', async () => {
      const handler = getHandler('updater:install');
      await handler(null);

      expect(mockInstallUpdate).toHaveBeenCalled();
    });

    it('should propagate errors from installUpdate', () => {
      mockInstallUpdate.mockImplementation(() => {
        throw new Error('Install failed');
      });

      const handler = getHandler('updater:install');
      expect(() => handler(null)).toThrow('Install failed');
    });
  });
});
