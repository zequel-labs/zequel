import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mountedCallbacks, unmountedCallbacks, mockToast, mockUpdater } = vi.hoisted(() => {
  const mountedCallbacks: Array<() => void> = []
  const unmountedCallbacks: Array<() => void> = []
  const mockToast = Object.assign(vi.fn(), { error: vi.fn() })
  const mockUpdater = {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    onStatus: vi.fn(),
    removeListener: vi.fn()
  }
  return { mountedCallbacks, unmountedCallbacks, mockToast, mockUpdater }
})

vi.mock('vue', () => ({
  onMounted: (cb: () => void) => mountedCallbacks.push(cb),
  onUnmounted: (cb: () => void) => unmountedCallbacks.push(cb)
}))

vi.mock('vue-sonner', () => ({
  toast: mockToast
}))

Object.defineProperty(globalThis, 'window', {
  value: { api: { updater: mockUpdater } },
  writable: true
})

import { useAutoUpdater } from '@/composables/useAutoUpdater'

interface UpdateStatusEvent {
  status: string
  version?: string
  progress?: number
  error?: string
}

describe('useAutoUpdater composable', () => {
  let handleStatus: (event: UpdateStatusEvent) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mountedCallbacks.length = 0
    unmountedCallbacks.length = 0

    useAutoUpdater()

    // Trigger onMounted to register the handler
    mountedCallbacks.forEach((cb) => cb())
    handleStatus = mockUpdater.onStatus.mock.calls[0][0] as (event: UpdateStatusEvent) => void
  })

  it('should show toast with Download action when update is available', () => {
    handleStatus({ status: 'available', version: '2.0.0' })

    expect(mockToast).toHaveBeenCalledWith('Update Available', expect.objectContaining({
      description: 'Version 2.0.0 is available.',
      duration: 10000,
      action: expect.objectContaining({ label: 'Download' })
    }))
  })

  it('should call downloadUpdate when Download action is clicked', () => {
    handleStatus({ status: 'available', version: '2.0.0' })

    const callArgs = mockToast.mock.calls[0][1] as { action: { onClick: () => void } }
    callArgs.action.onClick()

    expect(mockUpdater.downloadUpdate).toHaveBeenCalled()
  })

  it('should show toast with Restart action when update is downloaded', () => {
    handleStatus({ status: 'downloaded', version: '2.0.0' })

    expect(mockToast).toHaveBeenCalledWith('Update Ready', expect.objectContaining({
      description: 'Version 2.0.0 has been downloaded.',
      duration: Infinity,
      action: expect.objectContaining({ label: 'Restart' })
    }))
  })

  it('should call installUpdate when Restart action is clicked', () => {
    handleStatus({ status: 'downloaded', version: '2.0.0' })

    const callArgs = mockToast.mock.calls[0][1] as { action: { onClick: () => void } }
    callArgs.action.onClick()

    expect(mockUpdater.installUpdate).toHaveBeenCalled()
  })

  it('should show error toast when error has a message', () => {
    handleStatus({ status: 'error', error: 'Network timeout' })

    expect(mockToast.error).toHaveBeenCalledWith('Update Error', {
      description: 'Network timeout'
    })
  })

  it('should not show toast when error has no message', () => {
    handleStatus({ status: 'error' })

    expect(mockToast).not.toHaveBeenCalled()
    expect(mockToast.error).not.toHaveBeenCalled()
  })

  it('should not show toast for silent statuses', () => {
    const silentStatuses = ['checking', 'not-available', 'downloading']

    for (const status of silentStatuses) {
      vi.clearAllMocks()
      handleStatus({ status })
      expect(mockToast).not.toHaveBeenCalled()
      expect(mockToast.error).not.toHaveBeenCalled()
    }
  })
})
