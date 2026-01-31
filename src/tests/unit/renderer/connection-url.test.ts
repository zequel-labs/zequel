import { describe, it, expect } from 'vitest';
import { parseConnectionUrl } from '../../../renderer/lib/connection-url';
import { DatabaseType, DEFAULT_PORTS } from '../../../renderer/types/connection';

describe('Connection URL Parser', () => {
  describe('parseConnectionUrl', () => {
    describe('PostgreSQL URLs', () => {
      it('should parse a basic PostgreSQL URL', () => {
        const result = parseConnectionUrl('postgresql://user:pass@localhost:5432/mydb');
        expect(result).toEqual({
          type: DatabaseType.PostgreSQL,
          host: 'localhost',
          port: 5432,
          database: 'mydb',
          username: 'user',
          password: 'pass',
        });
      });

      it('should use default port when port is omitted', () => {
        const result = parseConnectionUrl('postgresql://user:pass@localhost/mydb');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.PostgreSQL]);
      });

      it('should throw for URL with empty host (no authority)', () => {
        // 'postgresql://user:pass@/mydb' is not a valid URL per the URL spec
        expect(() => parseConnectionUrl('postgresql://user:pass@/mydb')).toThrow('Invalid URL format');
      });

      it('should handle URL without credentials', () => {
        const result = parseConnectionUrl('postgresql://localhost:5432/mydb');
        expect(result.username).toBe('');
        expect(result.password).toBe('');
        expect(result.database).toBe('mydb');
      });

      it('should decode special characters in password', () => {
        const result = parseConnectionUrl('postgresql://user:p%40ss%23word@localhost:5432/mydb');
        expect(result.password).toBe('p@ss#word');
      });

      it('should decode special characters in username', () => {
        const result = parseConnectionUrl('postgresql://us%40er:pass@localhost:5432/mydb');
        expect(result.username).toBe('us@er');
      });

      it('should handle empty database name', () => {
        const result = parseConnectionUrl('postgresql://user:pass@localhost:5432/');
        expect(result.database).toBe('');
      });
    });

    describe('MySQL URLs', () => {
      it('should parse a basic MySQL URL', () => {
        const result = parseConnectionUrl('mysql://root:secret@127.0.0.1:3306/testdb');
        expect(result).toEqual({
          type: DatabaseType.MySQL,
          host: '127.0.0.1',
          port: 3306,
          database: 'testdb',
          username: 'root',
          password: 'secret',
        });
      });

      it('should use default MySQL port when port is omitted', () => {
        const result = parseConnectionUrl('mysql://root:secret@localhost/testdb');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.MySQL]);
      });
    });

    describe('MariaDB URLs', () => {
      it('should parse a basic MariaDB URL', () => {
        const result = parseConnectionUrl('mariadb://admin:pass@db-host:3307/appdb');
        expect(result).toEqual({
          type: DatabaseType.MariaDB,
          host: 'db-host',
          port: 3307,
          database: 'appdb',
          username: 'admin',
          password: 'pass',
        });
      });

      it('should use default MariaDB port when port is omitted', () => {
        const result = parseConnectionUrl('mariadb://admin:pass@localhost/appdb');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.MariaDB]);
      });
    });

    describe('ClickHouse URLs', () => {
      it('should parse a basic ClickHouse URL', () => {
        const result = parseConnectionUrl('clickhouse://default:@localhost:8123/default');
        expect(result).toEqual({
          type: DatabaseType.ClickHouse,
          host: 'localhost',
          port: 8123,
          database: 'default',
          username: 'default',
          password: '',
        });
      });

      it('should use default ClickHouse port when port is omitted', () => {
        const result = parseConnectionUrl('clickhouse://default:@localhost/default');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.ClickHouse]);
      });
    });

    describe('Redis URLs', () => {
      it('should parse a basic Redis URL', () => {
        const result = parseConnectionUrl('redis://default:mypassword@redis-host:6379/0');
        expect(result).toEqual({
          type: DatabaseType.Redis,
          host: 'redis-host',
          port: 6379,
          database: '0',
          username: 'default',
          password: 'mypassword',
        });
      });

      it('should use default Redis port when port is omitted', () => {
        const result = parseConnectionUrl('redis://:password@localhost/0');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.Redis]);
      });

      it('should handle Redis URL with no auth', () => {
        const result = parseConnectionUrl('redis://localhost:6379/0');
        expect(result.username).toBe('');
        expect(result.password).toBe('');
      });
    });

    describe('MongoDB URLs', () => {
      it('should parse a basic MongoDB URL', () => {
        const url = 'mongodb://admin:pass123@mongohost:27017/myapp';
        const result = parseConnectionUrl(url);
        expect(result.type).toBe(DatabaseType.MongoDB);
        expect(result.host).toBe('mongohost');
        expect(result.port).toBe(27017);
        expect(result.username).toBe('admin');
        expect(result.password).toBe('pass123');
      });

      it('should store the raw URL as the database field for MongoDB', () => {
        const url = 'mongodb://admin:pass123@mongohost:27017/myapp';
        const result = parseConnectionUrl(url);
        expect(result.database).toBe(url);
      });

      it('should use default MongoDB port when port is omitted', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@mongohost/myapp');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.MongoDB]);
      });

      it('should parse mongodb+srv URLs as MongoDB type', () => {
        const url = 'mongodb+srv://admin:pass@cluster0.example.net/mydb';
        const result = parseConnectionUrl(url);
        expect(result.type).toBe(DatabaseType.MongoDB);
        expect(result.database).toBe(url);
      });

      it('should throw for MongoDB URL with empty host', () => {
        // 'mongodb://admin:pass@/mydb' is not a valid URL per the URL spec
        expect(() => parseConnectionUrl('mongodb://admin:pass@/mydb')).toThrow('Invalid URL format');
      });
    });

    describe('Error handling', () => {
      it('should throw for empty URL', () => {
        expect(() => parseConnectionUrl('')).toThrow('URL is empty');
      });

      it('should throw for whitespace-only URL', () => {
        expect(() => parseConnectionUrl('   ')).toThrow('URL is empty');
      });

      it('should throw for invalid URL format', () => {
        expect(() => parseConnectionUrl('not-a-url')).toThrow('Invalid URL format');
      });

      it('should throw for unsupported scheme', () => {
        expect(() => parseConnectionUrl('ftp://localhost/file')).toThrow('Unsupported scheme "ftp"');
      });

      it('should throw for http scheme', () => {
        expect(() => parseConnectionUrl('http://localhost/db')).toThrow('Unsupported scheme');
      });

      it('should throw for https scheme', () => {
        expect(() => parseConnectionUrl('https://localhost/db')).toThrow('Unsupported scheme');
      });
    });

    describe('Edge cases', () => {
      it('should trim whitespace from URL before parsing', () => {
        const result = parseConnectionUrl('  postgresql://user:pass@localhost:5432/mydb  ');
        expect(result.type).toBe(DatabaseType.PostgreSQL);
        expect(result.database).toBe('mydb');
      });

      it('should handle database name with encoded characters', () => {
        const result = parseConnectionUrl('postgresql://user:pass@localhost:5432/my%20db');
        expect(result.database).toBe('my db');
      });

      it('should handle numeric port correctly', () => {
        const result = parseConnectionUrl('postgresql://user:pass@localhost:9999/db');
        expect(result.port).toBe(9999);
      });

      it('should handle password with encoded slashes', () => {
        const result = parseConnectionUrl('postgresql://user:pass%2Fword@localhost:5432/db');
        expect(result.password).toBe('pass/word');
      });

      it('should handle IPv6 host in brackets', () => {
        const result = parseConnectionUrl('postgresql://user:pass@[::1]:5432/mydb');
        // URL.hostname for IPv6 includes brackets
        expect(result.host).toBe('[::1]');
        expect(result.port).toBe(5432);
        expect(result.database).toBe('mydb');
      });
    });
  });
});
