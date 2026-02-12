import { describe, it, expect } from 'vitest';
import { isBooleanColumnType, parseBooleanValue } from '@/lib/boolean';

describe('Boolean Utilities', () => {
  describe('isBooleanColumnType', () => {
    it('should return true for PostgreSQL BOOLEAN', () => {
      expect(isBooleanColumnType('BOOLEAN')).toBe(true);
    });

    it('should return true for PostgreSQL BOOL', () => {
      expect(isBooleanColumnType('BOOL')).toBe(true);
    });

    it('should return true for ClickHouse Bool', () => {
      expect(isBooleanColumnType('Bool')).toBe(true);
    });

    it('should return true for MongoDB Boolean', () => {
      expect(isBooleanColumnType('Boolean')).toBe(true);
    });

    it('should return true for ClickHouse Nullable(Bool)', () => {
      expect(isBooleanColumnType('Nullable(Bool)')).toBe(true);
    });

    it('should return true for Nullable(Boolean)', () => {
      expect(isBooleanColumnType('Nullable(Boolean)')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isBooleanColumnType('boolean')).toBe(true);
      expect(isBooleanColumnType('bool')).toBe(true);
      expect(isBooleanColumnType('BOOLEAN')).toBe(true);
      expect(isBooleanColumnType('Bool')).toBe(true);
    });

    it('should return false for VARCHAR', () => {
      expect(isBooleanColumnType('VARCHAR')).toBe(false);
    });

    it('should return false for INTEGER', () => {
      expect(isBooleanColumnType('INTEGER')).toBe(false);
    });

    it('should return false for TEXT', () => {
      expect(isBooleanColumnType('TEXT')).toBe(false);
    });

    it('should return false for TINYINT', () => {
      expect(isBooleanColumnType('TINYINT')).toBe(false);
    });

    it('should return false for BIT', () => {
      expect(isBooleanColumnType('BIT')).toBe(false);
    });

    it('should return false for TINYINT(1)', () => {
      expect(isBooleanColumnType('TINYINT(1)')).toBe(false);
    });

    it('should return false for INT', () => {
      expect(isBooleanColumnType('INT')).toBe(false);
    });
  });

  describe('parseBooleanValue', () => {
    it('should return true for boolean true', () => {
      expect(parseBooleanValue(true)).toBe(true);
    });

    it('should return false for boolean false', () => {
      expect(parseBooleanValue(false)).toBe(false);
    });

    it('should return true for string "true"', () => {
      expect(parseBooleanValue('true')).toBe(true);
    });

    it('should return false for string "false"', () => {
      expect(parseBooleanValue('false')).toBe(false);
    });

    it('should return true for string "t"', () => {
      expect(parseBooleanValue('t')).toBe(true);
    });

    it('should return false for string "f"', () => {
      expect(parseBooleanValue('f')).toBe(false);
    });

    it('should return true for string "1"', () => {
      expect(parseBooleanValue('1')).toBe(true);
    });

    it('should return false for string "0"', () => {
      expect(parseBooleanValue('0')).toBe(false);
    });

    it('should return true for string "yes"', () => {
      expect(parseBooleanValue('yes')).toBe(true);
    });

    it('should return false for string "no"', () => {
      expect(parseBooleanValue('no')).toBe(false);
    });

    it('should return true for number 1', () => {
      expect(parseBooleanValue(1)).toBe(true);
    });

    it('should return false for number 0', () => {
      expect(parseBooleanValue(0)).toBe(false);
    });

    it('should return true for non-zero numbers', () => {
      expect(parseBooleanValue(42)).toBe(true);
      expect(parseBooleanValue(-1)).toBe(true);
    });

    it('should return null for null', () => {
      expect(parseBooleanValue(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(parseBooleanValue(undefined)).toBeNull();
    });

    it('should return null for string "null"', () => {
      expect(parseBooleanValue('null')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseBooleanValue('')).toBeNull();
    });

    it('should be case insensitive for string values', () => {
      expect(parseBooleanValue('TRUE')).toBe(true);
      expect(parseBooleanValue('FALSE')).toBe(false);
      expect(parseBooleanValue('True')).toBe(true);
      expect(parseBooleanValue('False')).toBe(false);
      expect(parseBooleanValue('T')).toBe(true);
      expect(parseBooleanValue('F')).toBe(false);
    });

    it('should handle whitespace in strings', () => {
      expect(parseBooleanValue(' true ')).toBe(true);
      expect(parseBooleanValue(' false ')).toBe(false);
    });

    it('should return null for unrecognized strings', () => {
      expect(parseBooleanValue('maybe')).toBeNull();
      expect(parseBooleanValue('hello')).toBeNull();
    });

    it('should return null for objects', () => {
      expect(parseBooleanValue({})).toBeNull();
      expect(parseBooleanValue([])).toBeNull();
    });
  });
});
