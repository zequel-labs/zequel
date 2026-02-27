import { describe, it, expect } from 'vitest';
import { parseConnectionUrl } from '@/lib/connection-url';
import { DatabaseType, DEFAULT_PORTS, SSLMode } from '@/types/connection';

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
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
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

    describe('postgres:// alias', () => {
      it('should parse postgres:// as PostgreSQL type', () => {
        const result = parseConnectionUrl('postgres://user:pass@localhost:5432/mydb');
        expect(result).toEqual({
          type: DatabaseType.PostgreSQL,
          host: 'localhost',
          port: 5432,
          database: 'mydb',
          username: 'user',
          password: 'pass',
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
        });
      });

      it('should use default PostgreSQL port for postgres:// scheme', () => {
        const result = parseConnectionUrl('postgres://user:pass@localhost/mydb');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.PostgreSQL]);
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
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
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
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
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
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
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
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
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

    describe('rediss:// scheme', () => {
      it('should parse rediss:// as Redis with SSL enabled', () => {
        const result = parseConnectionUrl('rediss://default:pass@redis-host:6380/0');
        expect(result).toEqual({
          type: DatabaseType.Redis,
          host: 'redis-host',
          port: 6380,
          database: '0',
          username: 'default',
          password: 'pass',
          ssl: true,
          sslConfig: {
            enabled: true,
            mode: SSLMode.Require,
            rejectUnauthorized: true,
          },
          trustServerCertificate: false,
        });
      });

      it('should use default Redis port for rediss:// when port is omitted', () => {
        const result = parseConnectionUrl('rediss://:password@localhost/0');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.Redis]);
        expect(result.ssl).toBe(true);
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

    describe('SQL Server URLs', () => {
      it('should parse a basic mssql:// URL', () => {
        const result = parseConnectionUrl('mssql://sa:Zequel123!@localhost:1433/zequel');
        expect(result).toEqual({
          type: DatabaseType.SQLServer,
          host: 'localhost',
          port: 1433,
          database: 'zequel',
          username: 'sa',
          password: 'Zequel123!',
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
        });
      });

      it('should parse a sqlserver:// URL', () => {
        const result = parseConnectionUrl('sqlserver://sa:pass@db-host:14330/mydb');
        expect(result).toEqual({
          type: DatabaseType.SQLServer,
          host: 'db-host',
          port: 14330,
          database: 'mydb',
          username: 'sa',
          password: 'pass',
          ssl: false,
          sslConfig: null,
          trustServerCertificate: false,
        });
      });

      it('should use default SQL Server port when port is omitted', () => {
        const result = parseConnectionUrl('mssql://sa:pass@localhost/mydb');
        expect(result.port).toBe(DEFAULT_PORTS[DatabaseType.SQLServer]);
      });

      it('should handle encoded password with special characters', () => {
        const result = parseConnectionUrl('mssql://sa:P%40ss%21word@localhost:1433/db');
        expect(result.password).toBe('P@ss!word');
      });
    });

    describe('SSL parsing - PostgreSQL', () => {
      it('should parse sslmode=require', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=require');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: false,
        });
      });

      it('should parse sslmode=verify-full', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=verify-full');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.VerifyFull,
          rejectUnauthorized: true,
        });
      });

      it('should parse sslmode=verify-ca', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=verify-ca');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.VerifyCA,
          rejectUnauthorized: true,
        });
      });

      it('should parse sslmode=prefer', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=prefer');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Prefer,
          rejectUnauthorized: false,
        });
      });

      it('should parse sslmode=disable', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=disable');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toEqual({
          enabled: false,
          mode: SSLMode.Disable,
          rejectUnauthorized: false,
        });
      });

      it('should handle sslmode case-insensitively', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=REQUIRE');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.Require);
      });

      it('should ignore unknown sslmode values', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db?sslmode=unknown');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toBeNull();
      });

      it('should parse sslmode with postgres:// alias', () => {
        const result = parseConnectionUrl('postgres://user:pass@host:5432/db?sslmode=require');
        expect(result.type).toBe(DatabaseType.PostgreSQL);
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.Require);
      });
    });

    describe('SSL parsing - MySQL/MariaDB', () => {
      it('should parse ssl-mode=REQUIRED for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=REQUIRED');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: false,
        });
      });

      it('should parse ssl-mode=VERIFY_CA for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=VERIFY_CA');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.VerifyCA);
        expect(result.sslConfig!.rejectUnauthorized).toBe(true);
      });

      it('should parse ssl-mode=VERIFY_IDENTITY for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=VERIFY_IDENTITY');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.VerifyFull);
        expect(result.sslConfig!.rejectUnauthorized).toBe(true);
      });

      it('should parse ssl-mode=DISABLED for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=DISABLED');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toEqual({
          enabled: false,
          mode: SSLMode.Disable,
          rejectUnauthorized: false,
        });
      });

      it('should handle ssl-mode case-insensitively for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=required');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.Require);
      });

      it('should parse ssl=true as boolean fallback for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: false,
        });
      });

      it('should parse ssl=false as boolean fallback for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl=false');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toEqual({
          enabled: false,
          mode: SSLMode.Disable,
          rejectUnauthorized: false,
        });
      });

      it('should give ssl-mode precedence over ssl for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db?ssl-mode=DISABLED&ssl=true');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig!.mode).toBe(SSLMode.Disable);
      });

      it('should parse ssl-mode for MariaDB', () => {
        const result = parseConnectionUrl('mariadb://admin:pass@host:3306/db?ssl-mode=REQUIRED');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.Require);
      });
    });

    describe('SSL parsing - MongoDB', () => {
      it('should parse tls=true for MongoDB', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@host:27017/db?tls=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: true,
        });
      });

      it('should parse ssl=true for MongoDB', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@host:27017/db?ssl=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.enabled).toBe(true);
      });

      it('should give tls precedence over ssl for MongoDB', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@host:27017/db?tls=false&ssl=true');
        expect(result.ssl).toBe(false);
      });

      it('should parse tlsAllowInvalidCertificates for MongoDB', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@host:27017/db?tls=true&tlsAllowInvalidCertificates=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.rejectUnauthorized).toBe(false);
      });

      it('should default rejectUnauthorized to true for MongoDB tls', () => {
        const result = parseConnectionUrl('mongodb://admin:pass@host:27017/db?tls=true');
        expect(result.sslConfig!.rejectUnauthorized).toBe(true);
      });

      it('should enable TLS by default for mongodb+srv:// without explicit tls param', () => {
        const result = parseConnectionUrl('mongodb+srv://user:pass@cluster.example.com/mydb');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: true,
        });
      });

      it('should allow explicit tls=false to override mongodb+srv:// default', () => {
        const result = parseConnectionUrl('mongodb+srv://user:pass@cluster.example.com/mydb?tls=false');
        expect(result.ssl).toBe(false);
      });

      it('should parse tlsAllowInvalidCertificates=true for mongodb+srv://', () => {
        const result = parseConnectionUrl('mongodb+srv://user:pass@cluster.example.com/mydb?tlsAllowInvalidCertificates=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.rejectUnauthorized).toBe(false);
      });
    });

    describe('SSL parsing - ClickHouse', () => {
      it('should parse secure=true for ClickHouse', () => {
        const result = parseConnectionUrl('clickhouse://default:@host:8443/default?secure=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: false,
        });
      });

      it('should parse secure=1 for ClickHouse', () => {
        const result = parseConnectionUrl('clickhouse://default:@host:8443/default?secure=1');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.enabled).toBe(true);
      });

      it('should parse secure=false for ClickHouse', () => {
        const result = parseConnectionUrl('clickhouse://default:@host:8123/default?secure=false');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toEqual({
          enabled: false,
          mode: SSLMode.Disable,
          rejectUnauthorized: false,
        });
      });
    });

    describe('SSL parsing - SQL Server', () => {
      it('should parse encrypt=true for SQL Server', () => {
        const result = parseConnectionUrl('mssql://sa:pass@host:1433/db?encrypt=true');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig).toEqual({
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: false,
        });
      });

      it('should parse trustServerCertificate=true for SQL Server', () => {
        const result = parseConnectionUrl('mssql://sa:pass@host:1433/db?encrypt=true&trustServerCertificate=true');
        expect(result.ssl).toBe(true);
        expect(result.trustServerCertificate).toBe(true);
      });

      it('should parse encrypt=false for SQL Server', () => {
        const result = parseConnectionUrl('mssql://sa:pass@host:1433/db?encrypt=false');
        expect(result.ssl).toBe(false);
        expect(result.trustServerCertificate).toBe(false);
      });
    });

    describe('SSL parsing - generic fallback', () => {
      it('should use sslmode as generic fallback for ClickHouse', () => {
        const result = parseConnectionUrl('clickhouse://default:@host:8443/default?sslmode=require');
        expect(result.ssl).toBe(true);
        expect(result.sslConfig!.mode).toBe(SSLMode.Require);
      });
    });

    describe('No SSL params', () => {
      it('should return ssl: false when no SSL params present for PostgreSQL', () => {
        const result = parseConnectionUrl('postgresql://user:pass@host:5432/db');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toBeNull();
        expect(result.trustServerCertificate).toBe(false);
      });

      it('should return ssl: false when no SSL params present for MySQL', () => {
        const result = parseConnectionUrl('mysql://root:pass@host:3306/db');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toBeNull();
        expect(result.trustServerCertificate).toBe(false);
      });

      it('should return ssl: false for regular mongodb:// without TLS params', () => {
        const result = parseConnectionUrl('mongodb://user:pass@host/mydb');
        expect(result.ssl).toBe(false);
        expect(result.sslConfig).toBeNull();
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
