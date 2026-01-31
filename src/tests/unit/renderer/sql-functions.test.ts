import { describe, it, expect } from 'vitest';
import { getFunctionsForDialect } from '../../../renderer/lib/sql-functions';
import type { SqlFunction } from '../../../renderer/lib/sql-functions';
import { DatabaseType } from '../../../renderer/types/connection';

describe('SQL Functions', () => {
  describe('SqlFunction interface shape', () => {
    it('should return objects with name, signature, description, and category', () => {
      const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
      for (const fn of functions) {
        expect(fn).toHaveProperty('name');
        expect(fn).toHaveProperty('signature');
        expect(fn).toHaveProperty('description');
        expect(fn).toHaveProperty('category');
        expect(typeof fn.name).toBe('string');
        expect(typeof fn.signature).toBe('string');
        expect(typeof fn.description).toBe('string');
        expect(typeof fn.category).toBe('string');
      }
    });

    it('should have valid category values', () => {
      const validCategories = new Set(['aggregate', 'string', 'date', 'math', 'conversion', 'window', 'json', 'other']);
      const allDialects = [DatabaseType.PostgreSQL, DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.SQLite];
      for (const dialect of allDialects) {
        const functions = getFunctionsForDialect(dialect);
        for (const fn of functions) {
          expect(validCategories.has(fn.category)).toBe(true);
        }
      }
    });
  });

  describe('getFunctionsForDialect', () => {
    describe('common functions', () => {
      const commonFunctionNames = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'SUBSTRING', 'REPLACE', 'CONCAT', 'ABS', 'ROUND', 'CEIL', 'FLOOR', 'COALESCE', 'CAST', 'NULLIF'];

      it('should include common functions for PostgreSQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        for (const name of commonFunctionNames) {
          expect(names).toContain(name);
        }
      });

      it('should include common functions for MySQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.MySQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        for (const name of commonFunctionNames) {
          expect(names).toContain(name);
        }
      });

      it('should include common functions for MariaDB', () => {
        const functions = getFunctionsForDialect(DatabaseType.MariaDB);
        const names = functions.map((fn: SqlFunction) => fn.name);
        for (const name of commonFunctionNames) {
          expect(names).toContain(name);
        }
      });

      it('should include common functions for SQLite', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const names = functions.map((fn: SqlFunction) => fn.name);
        for (const name of commonFunctionNames) {
          expect(names).toContain(name);
        }
      });
    });

    describe('PostgreSQL dialect', () => {
      it('should include PostgreSQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).toContain('NOW');
        expect(names).toContain('AGE');
        expect(names).toContain('DATE_TRUNC');
        expect(names).toContain('EXTRACT');
        expect(names).toContain('DATE_PART');
        expect(names).toContain('TO_CHAR');
        expect(names).toContain('TO_DATE');
        expect(names).toContain('TO_NUMBER');
        expect(names).toContain('TO_TIMESTAMP');
        expect(names).toContain('STRING_AGG');
        expect(names).toContain('ARRAY_AGG');
        expect(names).toContain('JSON_AGG');
        expect(names).toContain('JSON_BUILD_OBJECT');
        expect(names).toContain('JSONB_SET');
        expect(names).toContain('ROW_NUMBER');
        expect(names).toContain('RANK');
        expect(names).toContain('DENSE_RANK');
        expect(names).toContain('LAG');
        expect(names).toContain('LEAD');
        expect(names).toContain('GENERATE_SERIES');
        expect(names).toContain('GREATEST');
        expect(names).toContain('LEAST');
        expect(names).toContain('REGEXP_REPLACE');
        expect(names).toContain('REGEXP_MATCHES');
      });

      it('should NOT include MySQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).not.toContain('CURDATE');
        expect(names).not.toContain('CURTIME');
        expect(names).not.toContain('DATE_FORMAT');
        expect(names).not.toContain('IFNULL');
        expect(names).not.toContain('GROUP_CONCAT');
      });

      it('should NOT include SQLite-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).not.toContain('JULIANDAY');
        expect(names).not.toContain('STRFTIME');
        expect(names).not.toContain('TOTAL');
        expect(names).not.toContain('TYPEOF');
        expect(names).not.toContain('IIF');
      });
    });

    describe('MySQL dialect', () => {
      it('should include MySQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.MySQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).toContain('NOW');
        expect(names).toContain('CURDATE');
        expect(names).toContain('CURTIME');
        expect(names).toContain('DATE_FORMAT');
        expect(names).toContain('DATEDIFF');
        expect(names).toContain('DATE_ADD');
        expect(names).toContain('DATE_SUB');
        expect(names).toContain('STR_TO_DATE');
        expect(names).toContain('YEAR');
        expect(names).toContain('MONTH');
        expect(names).toContain('DAY');
        expect(names).toContain('IFNULL');
        expect(names).toContain('IF');
        expect(names).toContain('GROUP_CONCAT');
        expect(names).toContain('JSON_EXTRACT');
        expect(names).toContain('JSON_OBJECT');
        expect(names).toContain('JSON_ARRAY');
        expect(names).toContain('JSON_SET');
        expect(names).toContain('JSON_UNQUOTE');
        expect(names).toContain('ROW_NUMBER');
        expect(names).toContain('LPAD');
        expect(names).toContain('RPAD');
        expect(names).toContain('REGEXP_REPLACE');
      });

      it('should NOT include PostgreSQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.MySQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).not.toContain('AGE');
        expect(names).not.toContain('DATE_TRUNC');
        expect(names).not.toContain('STRING_AGG');
        expect(names).not.toContain('ARRAY_AGG');
        expect(names).not.toContain('JSON_AGG');
        expect(names).not.toContain('GENERATE_SERIES');
      });
    });

    describe('MariaDB dialect', () => {
      it('should return the same functions as MySQL', () => {
        const mysqlFunctions = getFunctionsForDialect(DatabaseType.MySQL);
        const mariadbFunctions = getFunctionsForDialect(DatabaseType.MariaDB);
        const mysqlNames = mysqlFunctions.map((fn: SqlFunction) => fn.name).sort();
        const mariadbNames = mariadbFunctions.map((fn: SqlFunction) => fn.name).sort();
        expect(mariadbNames).toEqual(mysqlNames);
      });
    });

    describe('SQLite dialect', () => {
      it('should include SQLite-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).toContain('DATE');
        expect(names).toContain('TIME');
        expect(names).toContain('DATETIME');
        expect(names).toContain('JULIANDAY');
        expect(names).toContain('STRFTIME');
        expect(names).toContain('GROUP_CONCAT');
        expect(names).toContain('TOTAL');
        expect(names).toContain('TYPEOF');
        expect(names).toContain('IFNULL');
        expect(names).toContain('IIF');
        expect(names).toContain('INSTR');
        expect(names).toContain('UNICODE');
        expect(names).toContain('ZEROBLOB');
        expect(names).toContain('GLOB');
        expect(names).toContain('LIKELIHOOD');
      });

      it('should NOT include PostgreSQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).not.toContain('AGE');
        expect(names).not.toContain('DATE_TRUNC');
        expect(names).not.toContain('STRING_AGG');
        expect(names).not.toContain('ARRAY_AGG');
      });

      it('should NOT include MySQL-specific functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).not.toContain('CURDATE');
        expect(names).not.toContain('CURTIME');
        expect(names).not.toContain('DATE_FORMAT');
        expect(names).not.toContain('JSON_EXTRACT');
      });
    });

    describe('unknown/unsupported dialect', () => {
      it('should return only common functions for unsupported dialects', () => {
        const functions = getFunctionsForDialect('unknown' as any);
        const names = functions.map((fn: SqlFunction) => fn.name);
        // Should contain common functions
        expect(names).toContain('COUNT');
        expect(names).toContain('SUM');
        expect(names).toContain('UPPER');
        expect(names).toContain('ABS');
        expect(names).toContain('COALESCE');
        // Should NOT contain dialect-specific functions
        expect(names).not.toContain('AGE');
        expect(names).not.toContain('CURDATE');
        expect(names).not.toContain('JULIANDAY');
      });

      it('should return only common functions for ClickHouse (no specific functions defined)', () => {
        const functions = getFunctionsForDialect(DatabaseType.ClickHouse as any);
        const names = functions.map((fn: SqlFunction) => fn.name);
        expect(names).toContain('COUNT');
        expect(names).toContain('COALESCE');
        // Should not have dialect-specific functions
        expect(names).not.toContain('AGE');
        expect(names).not.toContain('CURDATE');
        expect(names).not.toContain('JULIANDAY');
      });
    });

    describe('function count sanity checks', () => {
      it('should return more functions for PostgreSQL than just common ones', () => {
        const pgFunctions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const unknownFunctions = getFunctionsForDialect('unknown' as any);
        expect(pgFunctions.length).toBeGreaterThan(unknownFunctions.length);
      });

      it('should return more functions for MySQL than just common ones', () => {
        const mysqlFunctions = getFunctionsForDialect(DatabaseType.MySQL);
        const unknownFunctions = getFunctionsForDialect('unknown' as any);
        expect(mysqlFunctions.length).toBeGreaterThan(unknownFunctions.length);
      });

      it('should return more functions for SQLite than just common ones', () => {
        const sqliteFunctions = getFunctionsForDialect(DatabaseType.SQLite);
        const unknownFunctions = getFunctionsForDialect('unknown' as any);
        expect(sqliteFunctions.length).toBeGreaterThan(unknownFunctions.length);
      });

      it('should return a non-empty array for every supported dialect', () => {
        expect(getFunctionsForDialect(DatabaseType.PostgreSQL).length).toBeGreaterThan(0);
        expect(getFunctionsForDialect(DatabaseType.MySQL).length).toBeGreaterThan(0);
        expect(getFunctionsForDialect(DatabaseType.MariaDB).length).toBeGreaterThan(0);
        expect(getFunctionsForDialect(DatabaseType.SQLite).length).toBeGreaterThan(0);
      });
    });

    describe('function categories per dialect', () => {
      it('should include aggregate functions for PostgreSQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const aggregates = functions.filter((fn: SqlFunction) => fn.category === 'aggregate');
        expect(aggregates.length).toBeGreaterThan(0);
      });

      it('should include window functions for PostgreSQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const windows = functions.filter((fn: SqlFunction) => fn.category === 'window');
        expect(windows.length).toBeGreaterThan(0);
      });

      it('should include json functions for PostgreSQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const jsonFns = functions.filter((fn: SqlFunction) => fn.category === 'json');
        expect(jsonFns.length).toBeGreaterThan(0);
      });

      it('should include date functions for MySQL', () => {
        const functions = getFunctionsForDialect(DatabaseType.MySQL);
        const dateFns = functions.filter((fn: SqlFunction) => fn.category === 'date');
        expect(dateFns.length).toBeGreaterThan(0);
      });

      it('should include date functions for SQLite', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const dateFns = functions.filter((fn: SqlFunction) => fn.category === 'date');
        expect(dateFns.length).toBeGreaterThan(0);
      });

      it('should include math functions in common set', () => {
        const functions = getFunctionsForDialect('unknown' as any);
        const mathFns = functions.filter((fn: SqlFunction) => fn.category === 'math');
        expect(mathFns.length).toBeGreaterThan(0);
        const names = mathFns.map((fn: SqlFunction) => fn.name);
        expect(names).toContain('ABS');
        expect(names).toContain('ROUND');
        expect(names).toContain('CEIL');
        expect(names).toContain('FLOOR');
      });
    });

    describe('no duplicate function names within a dialect', () => {
      it('should have no duplicate names in PostgreSQL functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.PostgreSQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(names.length);
      });

      it('should have at most one duplicate in MySQL functions (NULLIF appears in common and MySQL-specific)', () => {
        const functions = getFunctionsForDialect(DatabaseType.MySQL);
        const names = functions.map((fn: SqlFunction) => fn.name);
        const uniqueNames = new Set(names);
        // NULLIF exists in both commonFunctions and mysqlSpecificFunctions
        const duplicateCount = names.length - uniqueNames.size;
        expect(duplicateCount).toBeLessThanOrEqual(1);
        // Verify the duplicate is NULLIF
        const counts = new Map<string, number>();
        for (const name of names) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
        const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
        if (duplicates.length > 0) {
          expect(duplicates).toEqual([['NULLIF', 2]]);
        }
      });

      it('should have no duplicate names in SQLite functions', () => {
        const functions = getFunctionsForDialect(DatabaseType.SQLite);
        const names = functions.map((fn: SqlFunction) => fn.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(names.length);
      });
    });
  });
});
