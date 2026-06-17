import { describe, it, expect } from 'vitest'
import { SSLMode } from '@main/types'
import { pgSslMode, mysqlSslMode } from '@main/services/backup/ssl-temp'

describe('pgSslMode', () => {
  it('maps known modes', () => {
    expect(pgSslMode(SSLMode.Disable)).toBe('disable')
    expect(pgSslMode(SSLMode.VerifyFull)).toBe('verify-full')
  })
  it('defaults to require', () => {
    expect(pgSslMode(undefined)).toBe('require')
  })
})

describe('mysqlSslMode', () => {
  it('maps verify modes', () => {
    expect(mysqlSslMode(SSLMode.VerifyCA)).toBe('VERIFY_CA')
    expect(mysqlSslMode(SSLMode.VerifyFull)).toBe('VERIFY_IDENTITY')
  })
  it('defaults to REQUIRED', () => {
    expect(mysqlSslMode(undefined)).toBe('REQUIRED')
  })
})
