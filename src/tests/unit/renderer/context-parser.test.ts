import { describe, it, expect } from 'vitest';
import {
  stripLiteralsAndComments,
  getRelevantContextText,
  extractCteNames,
  getSqlContext,
  resolveTableFromPrefix,
} from '@/lib/sql-completion/context-parser';
import type { SchemaMetadata } from '@/lib/sql-completion/types';

describe('Context Parser', () => {
  describe('stripLiteralsAndComments', () => {
    it('should replace single-quoted strings with spaces', () => {
      const result = stripLiteralsAndComments("SELECT 'hello' FROM t");
      expect(result).not.toContain('hello');
      expect(result).toContain('SELECT');
      expect(result).toContain('FROM');
    });

    it('should handle escaped single quotes inside strings', () => {
      const result = stripLiteralsAndComments("SELECT 'it''s' FROM t");
      expect(result).not.toContain('it');
      expect(result).toContain('SELECT');
    });

    it('should keep double-quoted identifiers', () => {
      const result = stripLiteralsAndComments('SELECT "my_col" FROM t');
      expect(result).toContain('"my_col"');
    });

    it('should handle escaped double quotes in identifiers', () => {
      const result = stripLiteralsAndComments('SELECT "col""name" FROM t');
      expect(result).toContain('"col""name"');
    });

    it('should replace line comments with spaces', () => {
      const result = stripLiteralsAndComments('SELECT 1 -- comment\nFROM t');
      expect(result).not.toContain('comment');
      expect(result).toContain('SELECT');
    });

    it('should replace block comments with spaces', () => {
      const result = stripLiteralsAndComments('SELECT /* comment */ 1 FROM t');
      expect(result).not.toContain('comment');
      expect(result).toContain('SELECT');
    });
  });

  describe('getRelevantContextText', () => {
    it('should return full text when no subquery parens', () => {
      const text = 'SELECT * FROM users WHERE id = 1';
      expect(getRelevantContextText(text)).toBe(text);
    });

    it('should return inner text for subquery', () => {
      const text = 'SELECT * FROM (SELECT id FROM users';
      const result = getRelevantContextText(text);
      expect(result).toContain('SELECT id FROM users');
    });

    it('should not strip for function call parens', () => {
      const text = 'SELECT COALESCE(col,';
      const result = getRelevantContextText(text);
      expect(result).toBe(text);
    });
  });

  describe('extractCteNames', () => {
    it('should extract CTE name from WITH ... AS', () => {
      const names = extractCteNames('WITH cte1 AS (SELECT 1) SELECT');
      expect(names).toContain('cte1');
    });

    it('should extract chained CTE names', () => {
      const names = extractCteNames('WITH cte1 AS (SELECT 1), cte2 AS (SELECT 2) SELECT');
      expect(names).toContain('cte1');
      expect(names).toContain('cte2');
    });

    it('should extract RECURSIVE CTE names', () => {
      const names = extractCteNames('WITH RECURSIVE cte1 AS (SELECT 1) SELECT');
      expect(names).toContain('cte1');
    });
  });

  describe('getSqlContext', () => {
    it('should detect SELECT context', () => {
      const info = getSqlContext('SELECT ');
      expect(info.context).toBe('select');
    });

    it('should detect FROM context', () => {
      const info = getSqlContext('SELECT * FROM ');
      expect(info.context).toBe('from');
    });

    it('should detect WHERE context', () => {
      const info = getSqlContext('SELECT * FROM users WHERE ');
      expect(info.context).toBe('where');
    });

    it('should extract table references from FROM clause', () => {
      const info = getSqlContext('SELECT * FROM users u JOIN orders o ON ');
      expect(info.referencedTables).toContain('users');
      expect(info.referencedTables).toContain('orders');
    });

    it('should extract aliases from FROM clause', () => {
      const info = getSqlContext('SELECT * FROM users u WHERE ');
      expect(info.tableAliases.get('u')).toBe('users');
    });
  });

  describe('resolveTableFromPrefix', () => {
    const schema: SchemaMetadata = {
      tables: [
        { name: 'users', schema: 'public', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'text' }] },
        { name: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'user_id', type: 'int' }] },
      ],
      views: [
        { name: 'active_users', schema: 'public', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'text' }] },
        { name: 'order_stats', columns: [{ name: 'total', type: 'int' }] },
      ],
    };

    it('should return undefined when schema is undefined', () => {
      const result = resolveTableFromPrefix('users', new Map(), undefined);
      expect(result).toBeUndefined();
    });

    it('should resolve a direct table name', () => {
      const result = resolveTableFromPrefix('users', new Map(), schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('users');
    });

    it('should resolve a direct view name', () => {
      const result = resolveTableFromPrefix('active_users', new Map(), schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('active_users');
    });

    it('should resolve an alias pointing to a table', () => {
      const aliases = new Map([['u', 'users']]);
      const result = resolveTableFromPrefix('u', aliases, schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('users');
    });

    it('should resolve an alias pointing to a view (simple name)', () => {
      const aliases = new Map([['au', 'active_users']]);
      const result = resolveTableFromPrefix('au', aliases, schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('active_users');
    });

    it('should resolve a schema-qualified alias pointing to a table', () => {
      const aliases = new Map([['u', 'public.users']]);
      const result = resolveTableFromPrefix('u', aliases, schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('users');
      expect(result!.schema).toBe('public');
    });

    it('should resolve a schema-qualified alias pointing to a view', () => {
      const aliases = new Map([['au', 'public.active_users']]);
      const result = resolveTableFromPrefix('au', aliases, schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('active_users');
      expect(result!.schema).toBe('public');
    });

    it('should return undefined for schema-qualified alias when table not found', () => {
      const aliases = new Map([['x', 'public.nonexistent']]);
      const result = resolveTableFromPrefix('x', aliases, schema);
      expect(result).toBeUndefined();
    });

    it('should return undefined for simple alias when table/view not found', () => {
      const aliases = new Map([['x', 'nonexistent_table']]);
      const result = resolveTableFromPrefix('x', aliases, schema);
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown prefix', () => {
      const result = resolveTableFromPrefix('nonexistent', new Map(), schema);
      expect(result).toBeUndefined();
    });

    it('should be case insensitive for prefix lookup', () => {
      const result = resolveTableFromPrefix('USERS', new Map(), schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('users');
    });

    it('should resolve view without schema when only name matches', () => {
      const result = resolveTableFromPrefix('order_stats', new Map(), schema);
      expect(result).toBeDefined();
      expect(result!.name).toBe('order_stats');
    });
  });
});
