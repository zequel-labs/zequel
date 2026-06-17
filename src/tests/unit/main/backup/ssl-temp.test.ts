import { describe, it, expect, vi } from 'vitest'

// Mock fs so writeSslTempFiles produces deterministic paths without touching disk.
vi.mock('fs/promises', () => ({
  mkdtemp: vi.fn(() => Promise.resolve('/tmp/zequel-ssl-test')),
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
  rmdir: vi.fn(() => Promise.resolve()),
  rm: vi.fn(() => Promise.resolve()),
}))

import { SSLMode, type SSLConfig } from '@main/types'
import { pgSslMode, mysqlSslMode, appendMongoTlsArgs } from '@main/services/backup/ssl-temp'

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

describe('appendMongoTlsArgs', () => {
  it('is a no-op when SSL is disabled', async () => {
    const args: string[] = []
    const tempFiles: string[] = []
    await appendMongoTlsArgs(args, tempFiles, false, null)
    expect(args).toEqual([])
    expect(tempFiles).toEqual([])
  })

  it('adds only --tls when enabled without a config', async () => {
    const args: string[] = []
    await appendMongoTlsArgs(args, [], true, null)
    expect(args).toEqual(['--tls'])
  })

  it('concatenates cert+key into one PEM and tracks temp files', async () => {
    const args: string[] = []
    const tempFiles: string[] = []
    const sslConfig = { ca: 'CA', cert: 'CERT', key: 'KEY', rejectUnauthorized: false } as unknown as SSLConfig
    await appendMongoTlsArgs(args, tempFiles, true, sslConfig)
    expect(args).toContain('--tls')
    expect(args).toContain('--tlsInsecure')
    expect(args).toContain('--tlsCAFile=/tmp/zequel-ssl-test/ca.pem')
    expect(args).toContain('--tlsCertificateKeyFile=/tmp/zequel-ssl-test/cert.pem')
    // Both cert and key temp files are tracked for cleanup.
    expect(tempFiles).toContain('/tmp/zequel-ssl-test/cert.pem')
    expect(tempFiles).toContain('/tmp/zequel-ssl-test/key.pem')
  })
})
