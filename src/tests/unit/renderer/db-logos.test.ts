import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../renderer/assets/images/postgresql.svg', () => ({ default: 'postgresql.svg' }));
vi.mock('../../../renderer/assets/images/mysql.svg', () => ({ default: 'mysql.svg' }));
vi.mock('../../../renderer/assets/images/mariadb.svg', () => ({ default: 'mariadb.svg' }));
vi.mock('../../../renderer/assets/images/mongodb.svg', () => ({ default: 'mongodb.svg' }));
vi.mock('../../../renderer/assets/images/redis.svg', () => ({ default: 'redis.svg' }));
vi.mock('../../../renderer/assets/images/sqlite.svg', () => ({ default: 'sqlite.svg' }));
vi.mock('../../../renderer/assets/images/clickhouse.svg', () => ({ default: 'clickhouse.svg' }));

import { getDbLogo } from '../../../renderer/lib/db-logos';
import { DatabaseType } from '../../../renderer/types/connection';

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
