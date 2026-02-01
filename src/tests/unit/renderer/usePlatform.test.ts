import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock window.api with a mutable platform
const mockApi = { platform: 'darwin' as string }

vi.stubGlobal('window', {
  api: mockApi,
})

import { usePlatform } from '../../../renderer/composables/usePlatform'

describe('usePlatform', () => {
  beforeEach(() => {
    mockApi.platform = 'darwin'
  })

  it('should detect macOS', () => {
    mockApi.platform = 'darwin'
    const { isMac, isWindows, isLinux, platform, titlebarHeight } = usePlatform()
    expect(platform.value).toBe('darwin')
    expect(isMac.value).toBe(true)
    expect(isWindows.value).toBe(false)
    expect(isLinux.value).toBe(false)
    expect(titlebarHeight.value).toBe(38)
  })

  it('should detect Windows', () => {
    mockApi.platform = 'win32'
    const { isMac, isWindows, isLinux, platform, titlebarHeight } = usePlatform()
    expect(platform.value).toBe('win32')
    expect(isMac.value).toBe(false)
    expect(isWindows.value).toBe(true)
    expect(isLinux.value).toBe(false)
    expect(titlebarHeight.value).toBe(0)
  })

  it('should detect Linux', () => {
    mockApi.platform = 'linux'
    const { isMac, isWindows, isLinux, platform, titlebarHeight } = usePlatform()
    expect(platform.value).toBe('linux')
    expect(isMac.value).toBe(false)
    expect(isWindows.value).toBe(false)
    expect(isLinux.value).toBe(true)
    expect(titlebarHeight.value).toBe(0)
  })

  it('should return titlebar height 38 only for macOS', () => {
    mockApi.platform = 'darwin'
    expect(usePlatform().titlebarHeight.value).toBe(38)

    mockApi.platform = 'win32'
    expect(usePlatform().titlebarHeight.value).toBe(0)

    mockApi.platform = 'linux'
    expect(usePlatform().titlebarHeight.value).toBe(0)
  })
})
