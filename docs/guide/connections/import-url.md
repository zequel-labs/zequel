# Import from URL

Instead of filling in each connection field manually, you can paste a connection URL and have the form auto-populated.

## How It Works

1. Open the connection form (see [Creating a Connection](./index.md)).
2. Click **"Import from URL"** and paste a connection URL.
3. Click **"Import"** — Zequel parses the URL and fills in the connection form automatically (host, port, username, password, database, and SSL).
4. Review the populated fields and adjust if needed (e.g. add SSL certificates).
5. Give the connection a name and click **"Save"**.

## Supported URL Schemes

Zequel recognizes the following URL schemes:

| Scheme | Database Type |
|--------|---------------|
| `postgresql://` | PostgreSQL |
| `postgres://` | PostgreSQL (alias) |
| `mysql://` | MySQL |
| `mariadb://` | MariaDB |
| `mongodb://` | MongoDB |
| `mongodb+srv://` | MongoDB |
| `redis://` | Redis |
| `rediss://` | Redis (with SSL enabled) |
| `clickhouse://` | ClickHouse |
| `mssql://` | SQL Server |
| `sqlserver://` | SQL Server |

## URL Format

Connection URLs follow this general structure:

```
scheme://username:password@host:port/database?param=value
```

### Examples

**PostgreSQL:**

```
postgresql://admin:secret@db.example.com:5432/myapp
```

**PostgreSQL with SSL:**

```
postgresql://admin:secret@db.example.com:5432/myapp?sslmode=require
```

**MySQL:**

```
mysql://root:password@127.0.0.1:3306/production
```

**MongoDB:**

```
mongodb://appuser:pass@cluster.example.com:27017/analytics
```

**Redis with SSL:**

```
rediss://:authpassword@cache.example.com:6379/0
```

## SSL/TLS Query Parameters

Zequel extracts SSL/TLS configuration from query parameters. The supported parameters vary by database type.

### PostgreSQL

| Parameter | Values | Example |
|-----------|--------|---------|
| `sslmode` | `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full` | `?sslmode=require` |

### MySQL / MariaDB

| Parameter | Values | Example |
|-----------|--------|---------|
| `ssl-mode` | `DISABLED`, `PREFERRED`, `REQUIRED`, `VERIFY_CA`, `VERIFY_IDENTITY` | `?ssl-mode=REQUIRED` |
| `ssl` | `true`, `false` (fallback if `ssl-mode` not set) | `?ssl=true` |

When both `ssl-mode` and `ssl` are present, `ssl-mode` takes precedence.

### MongoDB

| Parameter | Values | Example |
|-----------|--------|---------|
| `tls` | `true`, `false` | `?tls=true` |
| `ssl` | `true`, `false` (fallback if `tls` not set) | `?ssl=true` |
| `tlsAllowInvalidCertificates` | `true`, `false` | `?tls=true&tlsAllowInvalidCertificates=true` |

When both `tls` and `ssl` are present, `tls` takes precedence.

### Redis

Redis SSL is configured via the `rediss://` scheme rather than query parameters. Use `rediss://` instead of `redis://` to enable SSL with `require` mode.

### ClickHouse

| Parameter | Values | Example |
|-----------|--------|---------|
| `secure` | `true`, `1`, `false` | `?secure=true` |

### SQL Server

| Parameter | Values | Example |
|-----------|--------|---------|
| `encrypt` | `true`, `false` | `?encrypt=true` |
| `trustServerCertificate` | `true`, `false` | `?encrypt=true&trustServerCertificate=true` |

## Notes

- All parameter values are compared **case-insensitively**.
- If the URL contains a port, it overrides the default port for that database type.
- If the URL omits the port, the default port for the detected database type is used.
- Special characters in the password must be URL-encoded in the connection string (e.g. `p%40ss` for `p@ss`). Zequel decodes them automatically.
- SSL certificates (CA, client cert, client key) cannot be specified via URL. After importing, configure certificates in the SSL section of the connection form.
