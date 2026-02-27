import { describe, it, expect } from 'vitest';
import { needsQuoting, quoteIdentifier } from '@/lib/sql-completion/identifier-quoting';
import { DatabaseType } from '@/types/connection';

describe('Identifier Quoting', () => {
  describe('needsQuoting', () => {
    it('should return false for empty string', () => {
      expect(needsQuoting('')).toBe(false);
    });

    it('should return true for identifiers starting with a digit', () => {
      expect(needsQuoting('1column')).toBe(true);
    });

    it('should return true for identifiers with spaces', () => {
      expect(needsQuoting('my column')).toBe(true);
    });

    it('should return true for identifiers with special characters', () => {
      expect(needsQuoting('col-name')).toBe(true);
      expect(needsQuoting('col.name')).toBe(true);
    });

    it('should return true for reserved words', () => {
      expect(needsQuoting('select')).toBe(true);
      expect(needsQuoting('SELECT')).toBe(true);
      expect(needsQuoting('from')).toBe(true);
      expect(needsQuoting('table')).toBe(true);
    });

    it('should return false for simple identifiers', () => {
      expect(needsQuoting('users')).toBe(false);
      expect(needsQuoting('my_table')).toBe(false);
      expect(needsQuoting('Column1')).toBe(false);
    });
  });

  describe('quoteIdentifier', () => {
    it('should not quote simple identifiers', () => {
      expect(quoteIdentifier('users', DatabaseType.PostgreSQL)).toBe('users');
    });

    it('should double-quote for PostgreSQL', () => {
      expect(quoteIdentifier('my column', DatabaseType.PostgreSQL)).toBe('"my column"');
    });

    it('should double-quote for SQLite', () => {
      expect(quoteIdentifier('my column', DatabaseType.SQLite)).toBe('"my column"');
    });

    it('should double-quote for DuckDB', () => {
      expect(quoteIdentifier('my column', DatabaseType.DuckDB)).toBe('"my column"');
    });

    it('should backtick-quote for MySQL', () => {
      expect(quoteIdentifier('my column', DatabaseType.MySQL)).toBe('`my column`');
    });

    it('should backtick-quote for MariaDB', () => {
      expect(quoteIdentifier('my column', DatabaseType.MariaDB)).toBe('`my column`');
    });

    it('should double-quote for ClickHouse', () => {
      expect(quoteIdentifier('my column', DatabaseType.ClickHouse)).toBe('"my column"');
    });

    it('should bracket-quote for SQL Server', () => {
      expect(quoteIdentifier('my column', DatabaseType.SQLServer)).toBe('[my column]');
    });

    it('should escape closing brackets for SQL Server', () => {
      expect(quoteIdentifier('col]name', DatabaseType.SQLServer)).toBe('[col]]name]');
    });

    it('should return unquoted name for unknown dialect (default case)', () => {
      // Use a dialect value that does not match any case in the switch
      const result = quoteIdentifier('my column', 'unknown_dialect' as never);
      expect(result).toBe('my column');
    });

    it('should escape double quotes within PostgreSQL identifiers', () => {
      expect(quoteIdentifier('col"name', DatabaseType.PostgreSQL)).toBe('"col""name"');
    });

    it('should escape backticks within MySQL identifiers', () => {
      expect(quoteIdentifier('col`name', DatabaseType.MySQL)).toBe('`col``name`');
    });
  });
});
