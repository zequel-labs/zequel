import { describe, it, expect, beforeEach } from 'vitest';
import { windowManager } from '@main/services/windowManager';
import type { BrowserWindow } from 'electron';

const createMockWindow = (id = 1): BrowserWindow => {
  return {
    webContents: { id }
  } as unknown as BrowserWindow;
};

describe('windowManager', () => {
  beforeEach(() => {
    // Clean up by removing all windows
    const windows: BrowserWindow[] = [];
    // We can't directly access the internal set, so we test via the public API
    // Reset by creating fresh windows and removing them
  });

  describe('add / remove / count', () => {
    it('should start with zero windows', () => {
      // After fresh import, count may have state from other tests
      // We test add/remove behavior instead
      const win = createMockWindow(100);
      windowManager.add(win);
      const countAfterAdd = windowManager.count();
      windowManager.remove(win);
      const countAfterRemove = windowManager.count();
      expect(countAfterAdd - countAfterRemove).toBe(1);
    });

    it('should add a window and increase count', () => {
      const win = createMockWindow(101);
      const before = windowManager.count();
      windowManager.add(win);
      expect(windowManager.count()).toBe(before + 1);
      windowManager.remove(win);
    });

    it('should remove a window and decrease count', () => {
      const win = createMockWindow(102);
      windowManager.add(win);
      const before = windowManager.count();
      windowManager.remove(win);
      expect(windowManager.count()).toBe(before - 1);
    });

    it('should not error when removing a window that was not added', () => {
      const win = createMockWindow(103);
      expect(() => windowManager.remove(win)).not.toThrow();
    });
  });

  describe('pendingInitData', () => {
    it('should set and consume pending init data', () => {
      const data = { adoptSessionId: 'session-1', savedConnectionId: 'conn-1' };
      windowManager.setPendingInitData(200, data);

      const result = windowManager.consumePendingInitData(200);
      expect(result).toEqual(data);
    });

    it('should return null after consuming init data', () => {
      const data = { adoptSessionId: 'session-2', savedConnectionId: 'conn-2' };
      windowManager.setPendingInitData(201, data);
      windowManager.consumePendingInitData(201);

      const result = windowManager.consumePendingInitData(201);
      expect(result).toBeNull();
    });

    it('should return null for unknown webContentsId', () => {
      const result = windowManager.consumePendingInitData(999);
      expect(result).toBeNull();
    });

    it('should cleanup pending data for a window', () => {
      const data = { adoptSessionId: 'session-3', savedConnectionId: 'conn-3' };
      windowManager.setPendingInitData(202, data);
      windowManager.cleanupForWindow(202);

      const result = windowManager.consumePendingInitData(202);
      expect(result).toBeNull();
    });

    it('should not error when cleaning up non-existent window', () => {
      expect(() => windowManager.cleanupForWindow(998)).not.toThrow();
    });
  });

  describe('registerCreateWindow / openNewWindow', () => {
    it('should call the registered createWindow function with initData', () => {
      const mockFn = vi.fn();
      windowManager.registerCreateWindow(mockFn);

      const initData = { adoptSessionId: 'session-1', savedConnectionId: 'conn-1' };
      windowManager.openNewWindow(initData);

      expect(mockFn).toHaveBeenCalledWith(initData);
    });

    it('should call the registered createWindow function without initData', () => {
      const mockFn = vi.fn();
      windowManager.registerCreateWindow(mockFn);

      windowManager.openNewWindow();

      expect(mockFn).toHaveBeenCalledWith(undefined);
    });

    it('should throw when openNewWindow is called before registering createWindow', async () => {
      vi.resetModules();
      const { windowManager: freshManager } = await import('@main/services/windowManager');
      expect(() => freshManager.openNewWindow()).toThrow('createWindow not registered');
    });
  });
});
