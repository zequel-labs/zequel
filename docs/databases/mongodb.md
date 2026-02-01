# MongoDB

Zequel supports MongoDB as a NoSQL database. The MongoDB experience differs from relational databases -- instead of tables and rows, you work with collections and documents.

**Minimum supported version:** MongoDB 8+

## Connection Setup

To connect to a MongoDB instance, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | Server port | `27017` |
| User | Database user (if authentication is enabled) | -- |
| Password | User password | -- |
| Database | Target database name | -- |
| Auth Source | Authentication database (used in connection string) | `admin` |

### Connection String

You can also connect using a MongoDB connection string:

```
mongodb://user:password@host:27017/database?authSource=admin
```

The `authSource` parameter specifies which database holds the user credentials. This is typically `admin` unless your deployment uses a different authentication database.

### SSH Tunnels

You can connect to remote MongoDB instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

Zequel supports SSL/TLS connections to MongoDB. You can provide a CA certificate, client certificate, and client key to establish a secure connection.

## NoSQL Differences

MongoDB is a document database. The terminology and concepts differ from relational databases:

| Relational Concept | MongoDB Equivalent |
|--------------------|-------------------|
| Table | Collection |
| Row | Document |
| Column | Field |
| SQL Query | MongoDB Query Syntax |

Zequel adapts its interface for MongoDB. Instead of a SQL query editor, you use MongoDB query syntax to find, filter, and manipulate documents.

## Supported Features

### Collections

Browse all collections in a database. View collection statistics and metadata.

### Documents

View, create, edit, and delete documents within collections. Documents are displayed in the data grid with support for nested fields.

### Indexes

View and manage indexes on your collections.

## Limitations

The following features are **not available** for MongoDB:

- **SQL Query Editor** -- MongoDB uses its own query syntax instead of SQL.
- **Foreign Keys** -- MongoDB does not enforce referential integrity.
- **Views** -- Not managed through Zequel for MongoDB.
- **Routines / Triggers** -- Not applicable.
- **ER Diagrams** -- Not applicable for document databases.
- **Process Monitor** -- Not available.
- **Users** -- Not managed through Zequel for MongoDB.

## Data Operations

- **Browse** -- View documents in a paginated data grid.
- **Edit** -- Modify documents directly in the data grid.
- **Import** -- Load data into collections from external files.
- **Export** -- Export collection data or query results to various formats.
