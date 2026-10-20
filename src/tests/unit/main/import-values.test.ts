import { describe, it, expect } from 'vitest'
import { convertImportValue } from '@main/services/import-values'

describe('lossless row import values', () => {
  it.each(['BIGINT', 'NUMERIC(30,8)'])('keeps %s exact', type => {
    const value = type === 'BIGINT' ? '9007199254740993' : '123456789012345678.12345678'
    expect(convertImportValue(value, type)).toBe(value)
  })
  it.each(['BYTEA', 'BLOB', 'VARBINARY(MAX)'])('decodes exported %s bytes', type => {
    expect(convertImportValue('\\x00ff80', type)).toEqual(Buffer.from([0, 255, 128]))
    expect(convertImportValue('\\x', type)).toEqual(Buffer.alloc(0))
    expect(() => convertImportValue('\\x0', type)).toThrow('hexadecimal')
    expect(() => convertImportValue('not binary', type)).toThrow('hexadecimal')
  })
  it('distinguishes literal NULL, empty text and actual null', () => {
    expect(convertImportValue('NULL', 'TEXT')).toBe('NULL')
    expect(convertImportValue('', 'TEXT')).toBe('')
    expect(convertImportValue(null, 'TEXT')).toBeNull()
  })
  it('rejects invalid numeric and boolean input before writes', () => {
    expect(() => convertImportValue('1.5', 'BIGINT')).toThrow()
    expect(() => convertImportValue('NaN', 'DOUBLE')).toThrow()
    expect(() => convertImportValue('maybe', 'BOOLEAN')).toThrow()
  })
  it('unwraps ClickHouse Nullable and LowCardinality types before converting', () => {
    expect(convertImportValue('true', 'Nullable(Bool)')).toBe(true)
    expect(convertImportValue('0', 'LowCardinality(Nullable(Bool))')).toBe(false)
    expect(convertImportValue('123456789012345678.12345678', 'Nullable(Decimal(30, 8))')).toBe('123456789012345678.12345678')
    expect(() => convertImportValue('yes please', 'Nullable(Bool)')).toThrow('Invalid Nullable(Bool) value')
  })
})
