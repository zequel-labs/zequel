import { parse, stringify } from 'lossless-json'

/** Validate before binding. Exact numeric types stay strings to avoid IEEE-754 loss. */
export const convertImportValue = (value: unknown, targetType: string): unknown => {
  if (value === null || value === undefined) return null
  // ClickHouse wraps types, e.g. Nullable(Bool) or LowCardinality(Nullable(String)).
  let unwrapped = targetType.trim()
  while (/^(?:Nullable|LowCardinality)\(.*\)$/i.test(unwrapped)) unwrapped = unwrapped.replace(/^\w+\((.*)\)$/, '$1').trim()
  const type = unwrapped.toUpperCase().replace(/\(.*/, '').trim()
  const text = String(value)
  if (['BYTEA', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BINARY', 'VARBINARY', 'IMAGE'].includes(type)) {
    if (!/^\\x(?:[0-9a-f]{2})*$/i.test(text)) throw new Error(`Invalid ${targetType} value: expected \\x followed by hexadecimal bytes`)
    return Buffer.from(text.slice(2), 'hex')
  }
  if (['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'INT2', 'INT4', 'INT8', 'SERIAL', 'BIGSERIAL'].includes(type)) {
    if (!/^[+-]?\d+$/.test(text)) throw new Error(`Invalid ${targetType} value`)
    return text
  }
  if (['DECIMAL', 'NUMERIC', 'MONEY'].includes(type)) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new Error(`Invalid ${targetType} value`)
    return text
  }
  if (['FLOAT', 'DOUBLE', 'DOUBLE PRECISION', 'REAL', 'FLOAT4', 'FLOAT8'].includes(type)) {
    if (!text.trim() || !Number.isFinite(Number(text))) throw new Error(`Invalid ${targetType} value`)
    return Number(text)
  }
  if (['BOOLEAN', 'BOOL', 'BIT'].includes(type)) {
    if (['true', '1', 'yes'].includes(text.toLowerCase())) return true
    if (['false', '0', 'no'].includes(text.toLowerCase())) return false
    throw new Error(`Invalid ${targetType} value`)
  }
  if (['JSON', 'JSONB'].includes(type)) {
    const parsed: unknown = typeof value === 'string' ? parse(value) : value
    return stringify(parsed)
  }
  return typeof value === 'object' ? stringify(value) : text
}
