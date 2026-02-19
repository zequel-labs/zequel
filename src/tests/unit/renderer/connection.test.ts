import { describe, it, expect, vi } from 'vitest';
import { getEnvironmentTextClass, getConnectionSubtitle, buildDuplicateConnectionConfig } from '@/lib/connection';
import { DatabaseType } from '@/types/connection';
import type { SavedConnection } from '@/types/connection';

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'generated-id'),
}));

const makeConnection = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
  id: 'test-id',
  name: 'Test Connection',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  filepath: null,
  ssl: false,
  ssh: null,
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastConnectedAt: null,
  ...overrides,
});

describe('Connection Utilities', () => {
  describe('getEnvironmentTextClass', () => {
    it('should return destructive class for production', () => {
      expect(getEnvironmentTextClass('production')).toBe('text-destructive');
    });

    it('should return orange class for staging', () => {
      expect(getEnvironmentTextClass('staging')).toBe('text-orange-500');
    });

    it('should return blue class for development', () => {
      expect(getEnvironmentTextClass('development')).toBe('text-blue-500');
    });

    it('should return violet class for testing', () => {
      expect(getEnvironmentTextClass('testing')).toBe('text-violet-500');
    });

    it('should return emerald class for local', () => {
      expect(getEnvironmentTextClass('local')).toBe('text-emerald-500');
    });

    it('should return muted-foreground for unknown environment', () => {
      expect(getEnvironmentTextClass('unknown')).toBe('text-muted-foreground');
    });

    it('should return muted-foreground for empty string', () => {
      expect(getEnvironmentTextClass('')).toBe('text-muted-foreground');
    });
  });

  describe('getConnectionSubtitle', () => {
    it('should return filepath filename for SQLite connections', () => {
      const connection = makeConnection({
        type: DatabaseType.SQLite,
        filepath: '/home/user/data/mydb.sqlite',
      });
      expect(getConnectionSubtitle(connection)).toBe('mydb.sqlite');
    });

    it('should return full filepath if no slash in path for SQLite', () => {
      const connection = makeConnection({
        type: DatabaseType.SQLite,
        filepath: 'mydb.sqlite',
      });
      expect(getConnectionSubtitle(connection)).toBe('mydb.sqlite');
    });

    it('should return full filepath when split produces empty last segment for SQLite', () => {
      const connection = makeConnection({
        type: DatabaseType.SQLite,
        filepath: '/path/to/dir/',
      });
      // .pop() returns '', so fallback to full filepath
      expect(getConnectionSubtitle(connection)).toBe('/path/to/dir/');
    });

    it('should return filepath filename for DuckDB connections', () => {
      const connection = makeConnection({
        type: DatabaseType.DuckDB,
        filepath: '/home/user/data/analytics.duckdb',
      });
      expect(getConnectionSubtitle(connection)).toBe('analytics.duckdb');
    });

    it('should return raw MongoDB URL when database starts with mongodb', () => {
      const mongoUrl = 'mongodb://admin:pass@host:27017/myapp';
      const connection = makeConnection({
        type: DatabaseType.MongoDB,
        database: mongoUrl,
      });
      expect(getConnectionSubtitle(connection)).toBe(mongoUrl);
    });

    it('should show host:port and database for standard connections', () => {
      const connection = makeConnection({
        host: 'db.example.com',
        port: 5432,
        database: 'production',
      });
      expect(getConnectionSubtitle(connection)).toBe('db.example.com:5432 \u00B7 production');
    });

    it('should show host without port when port is not set', () => {
      const connection = makeConnection({
        host: 'db.example.com',
        port: null,
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('db.example.com \u00B7 mydb');
    });

    it('should default host to localhost when host is empty', () => {
      const connection = makeConnection({
        host: '',
        port: 3306,
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('localhost:3306 \u00B7 mydb');
    });

    it('should default host to localhost when host is null', () => {
      const connection = makeConnection({
        host: null,
        port: 3306,
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('localhost:3306 \u00B7 mydb');
    });

    it('should show SSH when SSH is enabled', () => {
      const connection = makeConnection({
        ssh: {
          enabled: true,
          host: 'bastion.example.com',
          port: 22,
          username: 'admin',
          authMethod: 'privateKey',
        },
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('SSH \u00B7 mydb');
    });

    it('should show host:port when SSH is disabled', () => {
      const connection = makeConnection({
        ssh: {
          enabled: false,
          host: 'bastion.example.com',
          port: 22,
          username: 'admin',
          authMethod: 'password',
        },
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('db.example.com:5432 \u00B7 mydb');
    });

    it('should omit database part when database is empty', () => {
      const connection = makeConnection({
        host: 'localhost',
        port: 5432,
        database: '',
      });
      expect(getConnectionSubtitle(connection)).toBe('localhost:5432');
    });

    it('should handle MongoDB with non-URL database normally', () => {
      const connection = makeConnection({
        type: DatabaseType.MongoDB,
        host: 'mongohost',
        port: 27017,
        database: 'myapp',
      });
      expect(getConnectionSubtitle(connection)).toBe('mongohost:27017 \u00B7 myapp');
    });

    it('should handle port as zero (falsy)', () => {
      const connection = makeConnection({
        host: 'localhost',
        port: 0,
        database: 'mydb',
      });
      expect(getConnectionSubtitle(connection)).toBe('localhost \u00B7 mydb');
    });
  });

  describe('buildDuplicateConnectionConfig', () => {
    it('should generate a new id and append (copy) to the name', () => {
      const conn = makeConnection({ name: 'My Database' });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.id).toBe('generated-id');
      expect(config.name).toBe('My Database (copy)');
    });

    it('should copy type, database, host, port, and username', () => {
      const conn = makeConnection({
        type: DatabaseType.MySQL,
        database: 'appdb',
        host: 'db.example.com',
        port: 3306,
        username: 'admin',
      });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.type).toBe(DatabaseType.MySQL);
      expect(config.database).toBe('appdb');
      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(3306);
      expect(config.username).toBe('admin');
    });

    it('should copy ssl and sslConfig', () => {
      const sslConfig = { ca: '/path/to/ca.pem' };
      const conn = makeConnection({ ssl: true, sslConfig });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.ssl).toBe(true);
      expect(config.sslConfig).toEqual(sslConfig);
    });

    it('should copy ssh config', () => {
      const ssh = {
        enabled: true,
        host: 'bastion.example.com',
        port: 22,
        username: 'tunnel',
        authMethod: 'privateKey' as const,
      };
      const conn = makeConnection({ ssh });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.ssh).toEqual(ssh);
    });

    it('should copy color, environment, and folder', () => {
      const conn = makeConnection({
        color: '#ff0000',
        environment: 'production',
        folder: 'Work',
      });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.color).toBe('#ff0000');
      expect(config.environment).toBe('production');
      expect(config.folder).toBe('Work');
    });

    it('should copy filepath for SQLite connections', () => {
      const conn = makeConnection({
        type: DatabaseType.SQLite,
        filepath: '/home/user/data.db',
      });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.filepath).toBe('/home/user/data.db');
    });

    it('should copy trustServerCertificate', () => {
      const conn = makeConnection({ trustServerCertificate: true });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.trustServerCertificate).toBe(true);
    });

    it('should not include password in the duplicated config', () => {
      const conn = makeConnection();
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.password).toBeUndefined();
    });

    it('should convert null fields to undefined', () => {
      const conn = makeConnection({
        host: null,
        port: null,
        username: null,
        filepath: null,
        ssh: null,
        color: null,
        environment: null,
        folder: null,
      });
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.host).toBeUndefined();
      expect(config.port).toBeUndefined();
      expect(config.username).toBeUndefined();
      expect(config.filepath).toBeUndefined();
      expect(config.ssh).toBeUndefined();
      expect(config.color).toBeUndefined();
      expect(config.environment).toBeUndefined();
      expect(config.folder).toBeUndefined();
    });

    it('should default database to empty string when null', () => {
      const conn = makeConnection();
      // Force database to null-ish via type assertion to test the ?? fallback
      (conn as unknown as { database: null }).database = null;
      const config = buildDuplicateConnectionConfig(conn);
      expect(config.database).toBe('');
    });
  });
});
