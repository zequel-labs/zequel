import { describe, expect, it } from 'vitest'
import { BSON } from 'mongodb'
import { parse } from 'lossless-json'
import { toBsonDocument, bsonCellText, toExtendedJson } from '@main/services/mongo-documents'

const canonical = (value: unknown): string => BSON.EJSON.stringify(value as BSON.Document, { relaxed: false })

describe('MongoDB document conversion', () => {
  it('restores relaxed Extended JSON exports with their BSON types', () => {
    const original = {
      _id: new BSON.ObjectId('6ad7af9fb900e6f5f1a9e97b'), n: new BSON.Int32(7), big: BSON.Long.fromString('9007199254740993'),
      amount: BSON.Decimal128.fromString('123456789012345678.12345678'), ratio: new BSON.Double(1.5), at: new Date('2026-01-02T03:04:05.123Z'),
      bytes: new BSON.Binary(Buffer.from([0, 255])), nested: { a: [new BSON.Int32(1), 'x'] }, nothing: null,
    }
    const exported = toExtendedJson({ ...original, whole: new BSON.Double(2), small: BSON.Long.fromNumber(5) })
    expect(exported).toContain('"n":7,')
    expect(exported).toContain('"ratio":1.5,')
    expect(exported).toContain('"at":{"$date":"2026-01-02T03:04:05.123Z"}')
    expect(canonical(toBsonDocument(parse(exported) as Record<string, unknown>))).toBe(canonical({ ...original, whole: new BSON.Double(2), small: BSON.Long.fromNumber(5) }))
  })

  it('types plain JSON numbers like mongoimport', () => {
    const document = toBsonDocument(parse('{"small":2147483647,"wide":2147483648,"real":1.0,"huge":99999999999999999999}') as Record<string, unknown>)
    expect(canonical(document)).toBe('{"small":{"$numberInt":"2147483647"},"wide":{"$numberLong":"2147483648"},"real":{"$numberDouble":"1.0"},"huge":{"$numberDouble":"100000000000000000000.0"}}')
  })

  it('rejects invalid Extended JSON wrappers before any write', () => {
    expect(() => toBsonDocument(parse('{"_id":{"$oid":"not-an-object-id"}}') as Record<string, unknown>)).toThrow()
  })

  it('writes CSV cells exactly', () => {
    expect(bsonCellText(BSON.Long.fromString('9007199254740993'))).toBe('9007199254740993')
    expect(bsonCellText(BSON.Decimal128.fromString('-0.00000001'))).toBe('-1E-8')
    expect(bsonCellText(new BSON.ObjectId('6ad7af9fb900e6f5f1a9e97b'))).toBe('6ad7af9fb900e6f5f1a9e97b')
    expect(bsonCellText(new Date('2026-01-02T03:04:05.123Z'))).toBe('2026-01-02T03:04:05.123Z')
    expect(bsonCellText({ a: [new BSON.Int32(1)] })).toBe('{"a":[1]}')
    expect(bsonCellText(null)).toBeNull()
  })
})
