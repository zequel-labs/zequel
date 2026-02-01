# Import from URL

Instead of filling in each connection field manually, you can paste a connection URL and have the form auto-populated.

## How It Works

1. Open the connection form (see [Creating a Connection](./index.md)).
2. Click **"Import from URL"** or paste a URL into the URL input field.
3. Zequel parses the URL and fills in the host, port, username, password, and database fields automatically.
4. Review the populated fields and adjust if needed.
5. Give the connection a name and click **"Save"**.

## Supported URL Schemes

Zequel recognizes the following URL schemes:

| Scheme | Database Type |
|--------|---------------|
| `postgresql://` | PostgreSQL |
| `postgres://` | PostgreSQL |
| `mysql://` | MySQL |
| `mariadb://` | MariaDB |
| `mongodb://` | MongoDB |
| `mongodb+srv://` | MongoDB |
| `redis://` | Redis |
| `rediss://` | Redis (with SSL) |
| `clickhouse://` | ClickHouse |

## URL Format

Connection URLs follow this general structure:

```
scheme://username:password@host:port/database
```

### Examples

**PostgreSQL:**

```
postgresql://admin:secret@db.example.com:5432/myapp
```

**MySQL:**

```
mysql://root:password@127.0.0.1:3306/production
```

**MongoDB:**

```
mongodb://appuser:pass@cluster.example.com:27017/analytics
```

**Redis:**

```
redis://:authpassword@cache.example.com:6379/0
```

## Query Parameters

Some connection URLs include query parameters (e.g. `?sslmode=require`). Zequel extracts the core connection fields from the URL. SSL and other advanced options should be configured separately in the connection form after import.

## Notes

- If the URL contains a port, it overrides the default port for that database type.
- If the URL omits the port, the default port for the detected database type is used.
- Special characters in the password must be URL-encoded in the connection string (e.g. `p%40ss` for `p@ss`). Zequel decodes them automatically.
