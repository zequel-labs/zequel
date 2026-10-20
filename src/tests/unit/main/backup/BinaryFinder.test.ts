import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn(() => null as string | null) }))
vi.mock('@main/services/settings', () => ({ settingsService: { get: mockGet, set: vi.fn() } }))

const { mockExistsSync, mockExecSync, mockExecFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockExecSync: vi.fn(() => ''),
  mockExecFileSync: vi.fn(() => ''),
}))
vi.mock('fs', () => ({ existsSync: mockExistsSync }))
vi.mock('child_process', () => ({ execSync: mockExecSync, execFileSync: mockExecFileSync }))

import { getMysqlVersionWarning } from '@main/services/backup/BinaryFinder'

describe('getMysqlVersionWarning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('warns for MySQL 9.x', () => {
    expect(getMysqlVersionWarning('9.4.0')).toContain('mysql_native_password')
  })
  it('does not warn for 8.x', () => {
    expect(getMysqlVersionWarning('8.0.36')).toBeNull()
  })
  it('returns null for unknown version', () => {
    expect(getMysqlVersionWarning(null)).toBeNull()
  })
})
