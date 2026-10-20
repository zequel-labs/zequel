import { BSON } from 'mongodb'
import { isLosslessNumber, type LosslessNumber } from 'lossless-json'

const INT32 = /^-?\d+$/

/**
 * Turns an exactly parsed Extended JSON record into BSON values, as mongoimport does:
 * integers become Int32 or Long, other numbers Double, and $oid/$date/$numberDecimal/...
 * wrappers their BSON types.
 */
export const toBsonDocument = (record: Record<string, unknown>): BSON.Document => {
  const canonical = (value: unknown): unknown => {
    if (isLosslessNumber(value)) {
      const text = (value as LosslessNumber).value
      if (!INT32.test(text)) return { $numberDouble: String(Number(text)) }
      const integer = BigInt(text)
      if (integer >= -(2n ** 31n) && integer < 2n ** 31n) return { $numberInt: text }
      if (integer >= -(2n ** 63n) && integer < 2n ** 63n) return { $numberLong: text }
      return { $numberDouble: String(Number(text)) }
    }
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonical(item)]))
    return value
  }
  const document = BSON.EJSON.deserialize(canonical(record) as BSON.Document, { relaxed: false })
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Each JSON row must be an object')
  return document as BSON.Document
}

/** CSV cell text for a BSON value: exact numbers and dates, hex ObjectIds, Extended JSON for the rest. */
export const bsonCellText = (value: unknown): unknown => {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof BSON.ObjectId) return value.toHexString()
  if (value instanceof BSON.Int32 || value instanceof BSON.Double || value instanceof BSON.Long || value instanceof BSON.Decimal128) return value.toString()
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return BSON.EJSON.stringify(value as BSON.Document, { relaxed: true })
}

/**
 * Relaxed Extended JSON that still round-trips exactly: js-bson's relaxed mode turns every Long into a
 * JavaScript number (rounding beyond 2^53) and whole Doubles into integers. Int32 values, fractional
 * Doubles and dates use the readable relaxed form; Longs and whole Doubles keep their type wrappers.
 */
export const toExtendedJson = (document: BSON.Document, space?: number): string => {
  const relax = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(relax)
    if (!value || typeof value !== 'object') return value
    const wrapper = value as Record<string, unknown>
    const keys = Object.keys(wrapper)
    if (keys.length === 1 && typeof wrapper.$numberInt === 'string') return Number(wrapper.$numberInt)
    if (keys.length === 1 && typeof wrapper.$numberDouble === 'string') {
      const number = Number(wrapper.$numberDouble)
      return Number.isFinite(number) && !Number.isInteger(number) && String(number) === wrapper.$numberDouble ? number : value
    }
    if (keys.length === 1 && wrapper.$date && typeof wrapper.$date === 'object') {
      const milliseconds = Number((wrapper.$date as { $numberLong?: string }).$numberLong)
      const date = new Date(milliseconds)
      // Relaxed $date is only defined for years 1970-9999.
      return milliseconds >= 0 && date.getUTCFullYear() <= 9999 ? { $date: date.toISOString() } : value
    }
    return Object.fromEntries(keys.map(key => [key, relax(wrapper[key])]))
  }
  return JSON.stringify(relax(BSON.EJSON.serialize(document, { relaxed: false })), undefined, space)
}
