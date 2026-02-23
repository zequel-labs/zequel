import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

let windowManager: typeof import('@main/services/windowManager').windowManager;

const createMockWindow = (id = 1): BrowserWindow => {
  return {
    webContents: { id }
  } as unknown as BrowserWindow;
};

describe('windowManager', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@main/services/windowManager');
    windowManager = mod.windowManager;
  });

  describe('add / remove / count', () => {
    it('should start with zero windows', () => {
      expect(windowManager.count()).toBe(0);
    });

    it('should add a window and increase count', () => {
      const win = createMockWindow(101);
      windowManager.add(win);
      expect(windowManager.count()).toBe(1);
    });

    it('should remove a window and decrease count', () => {
      const win = createMockWindow(102);
      windowManager.add(win);
      expect(windowManager.count()).toBe(1);
      windowManager.remove(win);
      expect(windowManager.count()).toBe(0);
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

  describe('session ownership', () => {
    it('should set and get session owner', () => {
      windowManager.setSessionOwner('session-1', 100);
      windowManager.setSessionOwner('session-2', 100);
      windowManager.setSessionOwner('session-3', 200);

      expect(windowManager.getSessionsForWindow(100)).toEqual(expect.arrayContaining(['session-1', 'session-2']));
      expect(windowManager.getSessionsForWindow(100)).toHaveLength(2);
      expect(windowManager.getSessionsForWindow(200)).toEqual(['session-3']);
    });

    it('should return empty array for unknown window', () => {
      expect(windowManager.getSessionsForWindow(999)).toEqual([]);
    });

    it('should remove session owner', () => {
      windowManager.setSessionOwner('session-rm', 100);
      expect(windowManager.getSessionsForWindow(100)).toContain('session-rm');

      windowManager.removeSessionOwner('session-rm');
      expect(windowManager.getSessionsForWindow(100)).not.toContain('session-rm');
    });

    it('should transfer session to new window', () => {
      windowManager.setSessionOwner('session-transfer', 100);
      expect(windowManager.getSessionsForWindow(100)).toContain('session-transfer');

      windowManager.transferSession('session-transfer', 200);
      expect(windowManager.getSessionsForWindow(100)).not.toContain('session-transfer');
      expect(windowManager.getSessionsForWindow(200)).toContain('session-transfer');
    });

    it('should clean up session ownership in cleanupForWindow', () => {
      windowManager.setSessionOwner('session-cleanup-1', 300);
      windowManager.setSessionOwner('session-cleanup-2', 300);
      windowManager.setSessionOwner('session-other', 400);

      windowManager.cleanupForWindow(300);

      expect(windowManager.getSessionsForWindow(300)).toEqual([]);
      expect(windowManager.getSessionsForWindow(400)).toContain('session-other');
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

    it('should throw when openNewWindow is called before registering createWindow', () => {
      // windowManager is freshly imported via beforeEach, so createWindow is not registered
      expect(() => windowManager.openNewWindow()).toThrow('createWindow not registered');
    });
  });
});
