import { describe, it, expect, vi } from 'vitest';

vi.mock('@/assets/images/postgresql.svg', () => ({ default: 'postgresql.svg' }));
vi.mock('@/assets/images/mysql.svg', () => ({ default: 'mysql.svg' }));
vi.mock('@/assets/images/mariadb.svg', () => ({ default: 'mariadb.svg' }));
vi.mock('@/assets/images/mongodb.svg', () => ({ default: 'mongodb.svg' }));
vi.mock('@/assets/images/redis.svg', () => ({ default: 'redis.svg' }));
vi.mock('@/assets/images/sqlite.svg', () => ({ default: 'sqlite.svg' }));
vi.mock('@/assets/images/clickhouse.svg', () => ({ default: 'clickhouse.svg' }));
vi.mock('@/assets/images/duckdb.svg', () => ({ default: 'duckdb.svg' }));
vi.mock('@/assets/images/microsoft-sql-server.svg', () => ({ default: 'microsoft-sql-server.svg' }));

import { getDbLogo } from '@/lib/db-logos';
import { DatabaseType } from '@/types/connection';

describe('Database Logos', () => {
  describe('getDbLogo', () => {
    it('should return PostgreSQL logo', () => {
      const logo = getDbLogo(DatabaseType.PostgreSQL);
      expect(logo).toBe('postgresql.svg');
    });

    it('should return MySQL logo', () => {
      const logo = getDbLogo(DatabaseType.MySQL);
      expect(logo).toBe('mysql.svg');
    });

    it('should return MariaDB logo', () => {
      const logo = getDbLogo(DatabaseType.MariaDB);
      expect(logo).toBe('mariadb.svg');
    });

    it('should return MongoDB logo', () => {
      const logo = getDbLogo(DatabaseType.MongoDB);
      expect(logo).toBe('mongodb.svg');
    });

    it('should return Redis logo', () => {
      const logo = getDbLogo(DatabaseType.Redis);
      expect(logo).toBe('redis.svg');
    });

    it('should return SQLite logo', () => {
      const logo = getDbLogo(DatabaseType.SQLite);
      expect(logo).toBe('sqlite.svg');
    });

    it('should return ClickHouse logo', () => {
      const logo = getDbLogo(DatabaseType.ClickHouse);
      expect(logo).toBe('clickhouse.svg');
    });

    it('should return DuckDB logo', () => {
      const logo = getDbLogo(DatabaseType.DuckDB);
      expect(logo).toBe('duckdb.svg');
    });

    it('should return SQL Server logo', () => {
      const logo = getDbLogo(DatabaseType.SQLServer);
      expect(logo).toBe('microsoft-sql-server.svg');
    });

    it('should return a defined value for every DatabaseType', () => {
      const allTypes = Object.values(DatabaseType);
      for (const dbType of allTypes) {
        const logo = getDbLogo(dbType);
        expect(logo).toBeDefined();
        expect(typeof logo).toBe('string');
      }
    });

    it('should return undefined for an invalid database type', () => {
      const logo = getDbLogo('nonexistent' as DatabaseType);
      expect(logo).toBeUndefined();
    });
  });
});
