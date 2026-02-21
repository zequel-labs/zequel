import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockOnStatus,
  mockRemoveListener,
  mockDownloadUpdate,
  mockInstallUpdate,
  mockToast,
} = vi.hoisted(() => {
  const toast = vi.fn() as ReturnType<typeof vi.fn> & { dismiss: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  toast.dismiss = vi.fn();
  toast.error = vi.fn();
  return {
    mockOnStatus: vi.fn(),
    mockRemoveListener: vi.fn(),
    mockDownloadUpdate: vi.fn(),
    mockInstallUpdate: vi.fn(),
    mockToast: toast,
  };
});

vi.mock('vue-sonner', () => ({
  toast: mockToast,
}));

// Track lifecycle hooks
let mountedFn: (() => void) | null = null;
let unmountedFn: (() => void) | null = null;

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return {
    ...actual,
    onMounted: vi.fn((fn: () => void) => { mountedFn = fn; }),
    onUnmounted: vi.fn((fn: () => void) => { unmountedFn = fn; }),
  };
});

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    updater: {
      onStatus: mockOnStatus,
      removeListener: mockRemoveListener,
      downloadUpdate: mockDownloadUpdate,
      installUpdate: mockInstallUpdate,
    },
  },
});

import { useAutoUpdater } from '@/composables/useAutoUpdater';

describe('useAutoUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountedFn = null;
    unmountedFn = null;
  });

  it('should register onStatus listener in onMounted', () => {
    useAutoUpdater();

    expect(mountedFn).not.toBeNull();
    mountedFn!();

    expect(mockOnStatus).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should call removeListener in onUnmounted', () => {
    useAutoUpdater();

    expect(unmountedFn).not.toBeNull();
    unmountedFn!();

    expect(mockRemoveListener).toHaveBeenCalled();
  });

  describe('handleStatus', () => {
    let handleStatus: (event: { status: string; version?: string; progress?: number; error?: string }) => void;

    beforeEach(() => {
      useAutoUpdater();
      mountedFn!();
      handleStatus = mockOnStatus.mock.calls[0][0];
    });

    it('should show toast for "available" status', () => {
      handleStatus({ status: 'available', version: '2.0.0' });

      expect(mockToast).toHaveBeenCalledWith('Update Available', expect.objectContaining({
        description: 'Version 2.0.0 is available.',
        duration: 10000,
      }));
    });

    it('should show toast for "downloading" status', () => {
      handleStatus({ status: 'downloading', version: '2.0.0' });

      expect(mockToast).toHaveBeenCalledWith('Downloading Update', expect.objectContaining({
        description: 'Downloading version 2.0.0...',
        duration: Infinity,
        id: 'update-downloading',
      }));
    });

    it('should dismiss downloading toast and show "downloaded" toast', () => {
      handleStatus({ status: 'downloaded', version: '2.0.0' });

      expect(mockToast.dismiss).toHaveBeenCalledWith('update-downloading');
      expect(mockToast).toHaveBeenCalledWith('Update Downloaded', expect.objectContaining({
        description: 'Version 2.0.0 is ready to install.',
        duration: Infinity,
      }));
    });

    it('should show error toast for "error" status with error message', () => {
      handleStatus({ status: 'error', error: 'Network timeout' });

      expect(mockToast.error).toHaveBeenCalledWith('Update Error', {
        description: 'Network timeout',
      });
    });

    it('should not show error toast when error status has no error message', () => {
      handleStatus({ status: 'error' });

      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it('should not show any toast for unknown status', () => {
      handleStatus({ status: 'unknown-status' });

      expect(mockToast).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });
});
