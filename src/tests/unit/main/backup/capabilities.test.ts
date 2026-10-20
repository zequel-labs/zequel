import { describe, expect, it } from 'vitest'
import { validateTransferRequest } from '@main/services/backup/capabilities'
import { DatabaseType, type TransferRequest } from '@main/types'
const request = (options: TransferRequest['options'] = {}): TransferRequest => ({ mode: 'restore', savedConnectionId: 'connection', database: 'destination', path: '/tmp/source.dump', compress: false, options })
describe('standalone transfer preflight', () => {
  it('prevents flags from changing the reviewed destination or ignoring errors', () => {
    expect(() => validateTransferRequest(DatabaseType.PostgreSQL, request({ create: true }))).toThrow('Unsupported option')
    expect(() => validateTransferRequest(DatabaseType.MySQL, request({ force: true }))).toThrow('Unsupported option')
  })
  it('rejects conflicting PostgreSQL transaction and parallel options', () => {
    expect(() => validateTransferRequest(DatabaseType.PostgreSQL, request({ jobs: 2, 'single-transaction': true }))).toThrow('Parallel jobs')
  })
  it('requires explicit MongoDB source namespaces', () => {
    expect(() => validateTransferRequest(DatabaseType.MongoDB, request())).toThrow('database name inside')
    expect(() => validateTransferRequest(DatabaseType.MongoDB, request({ sourceDatabase: '*' }))).toThrow('Namespace patterns')
    expect(() => validateTransferRequest(DatabaseType.MongoDB, request({ sourceDatabase: 'original' }))).not.toThrow()
  })
  it('accepts absolute Windows server paths on every client OS', () => {
    expect(() => validateTransferRequest(DatabaseType.SQLServer, { ...request(), path: 'C:\\backups\\source.bak' })).not.toThrow()
    expect(() => validateTransferRequest(DatabaseType.SQLServer, { ...request(), path: 'source.bak' })).toThrow('absolute path')
  })
})
