import { describe, it, expect } from 'vitest';
import { isDateValue, formatDateTime, formatDateShort, formatTime } from '../../../renderer/lib/date';

describe('Date Utilities', () => {
  describe('isDateValue', () => {
    it('should return true for Date objects', () => {
      expect(isDateValue(new Date())).toBe(true);
    });

    it('should return true for Date objects with specific dates', () => {
      expect(isDateValue(new Date('2024-01-15T10:30:00Z'))).toBe(true);
    });

    it('should return true for valid ISO date strings', () => {
      expect(isDateValue('2024-01-15')).toBe(true);
    });

    it('should return true for ISO datetime strings', () => {
      expect(isDateValue('2024-01-15T10:30:00Z')).toBe(true);
    });

    it('should return true for ISO datetime with timezone offset', () => {
      expect(isDateValue('2024-01-15T10:30:00+05:00')).toBe(true);
    });

    it('should return true for ISO date with time', () => {
      expect(isDateValue('2024-06-30 14:22:01')).toBe(true);
    });

    it('should return false for non-string, non-Date values', () => {
      expect(isDateValue(12345)).toBe(false);
      expect(isDateValue(null)).toBe(false);
      expect(isDateValue(undefined)).toBe(false);
      expect(isDateValue(true)).toBe(false);
      expect(isDateValue(false)).toBe(false);
      expect(isDateValue({})).toBe(false);
      expect(isDateValue([])).toBe(false);
    });

    it('should return false for non-date strings', () => {
      expect(isDateValue('hello world')).toBe(false);
      expect(isDateValue('not a date')).toBe(false);
      expect(isDateValue('abc-def-ghi')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDateValue('')).toBe(false);
    });

    it('should return false for strings that start with digits but are not dates', () => {
      expect(isDateValue('1234')).toBe(false);
      expect(isDateValue('12-34-56')).toBe(false);
    });

    it('should return true for strings matching YYYY-MM-DD pattern that dayjs considers valid', () => {
      // dayjs is lenient: '9999-99-99' matches the regex and dayjs parses it as valid
      expect(isDateValue('9999-99-99')).toBe(true);
    });

    it('should return true for date-only string with dashes', () => {
      expect(isDateValue('2023-12-25')).toBe(true);
    });
  });

  describe('formatDateTime', () => {
    it('should format a Date object as YYYY-MM-DD HH:mm:ss', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = formatDateTime(date);
      expect(result).toBe('2024-01-15 10:30:45');
    });

    it('should format an ISO date string', () => {
      const result = formatDateTime('2024-06-30T14:22:01');
      expect(result).toBe('2024-06-30 14:22:01');
    });

    it('should return "-" for null', () => {
      expect(formatDateTime(null)).toBe('-');
    });

    it('should return "-" for undefined', () => {
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('should return "-" for empty string', () => {
      expect(formatDateTime('')).toBe('-');
    });

    it('should return "-" for zero', () => {
      expect(formatDateTime(0)).toBe('-');
    });

    it('should format a date-only string', () => {
      const result = formatDateTime('2024-03-20');
      expect(result).toMatch(/^2024-03-20/);
    });
  });

  describe('formatDateShort', () => {
    it('should format a Date object as MMM D, YYYY, HH:mm', () => {
      const date = new Date('2024-01-15T10:30:00');
      const result = formatDateShort(date);
      expect(result).toBe('Jan 15, 2024, 10:30');
    });

    it('should format an ISO date string', () => {
      const result = formatDateShort('2024-12-25T08:00:00');
      expect(result).toBe('Dec 25, 2024, 08:00');
    });

    it('should return "Never" for null', () => {
      expect(formatDateShort(null)).toBe('Never');
    });

    it('should return "Never" for undefined', () => {
      expect(formatDateShort(undefined)).toBe('Never');
    });

    it('should return "Never" for empty string', () => {
      expect(formatDateShort('')).toBe('Never');
    });

    it('should return "Never" for zero', () => {
      expect(formatDateShort(0)).toBe('Never');
    });

    it('should format a date in the middle of the year', () => {
      const result = formatDateShort('2024-07-04T15:45:00');
      expect(result).toBe('Jul 4, 2024, 15:45');
    });
  });

  describe('formatTime', () => {
    it('should format a Date object as HH:mm:ss', () => {
      const date = new Date('2024-01-15T10:30:45');
      const result = formatTime(date);
      expect(result).toBe('10:30:45');
    });

    it('should format an ISO datetime string', () => {
      const result = formatTime('2024-06-30T14:22:01');
      expect(result).toBe('14:22:01');
    });

    it('should return "-" for null', () => {
      expect(formatTime(null)).toBe('-');
    });

    it('should return "-" for undefined', () => {
      expect(formatTime(undefined)).toBe('-');
    });

    it('should return "-" for empty string', () => {
      expect(formatTime('')).toBe('-');
    });

    it('should return "-" for zero', () => {
      expect(formatTime(0)).toBe('-');
    });

    it('should format midnight correctly', () => {
      const result = formatTime('2024-01-01T00:00:00');
      expect(result).toBe('00:00:00');
    });

    it('should format end of day correctly', () => {
      const result = formatTime('2024-01-01T23:59:59');
      expect(result).toBe('23:59:59');
    });
  });
});
