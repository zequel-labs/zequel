# Redis

Zequel supports Redis as a key-value store. The Redis experience is centered around browsing, inspecting, and managing keys and their values.

**Minimum supported version:** Redis 7+

## Connection Setup

To connect to a Redis instance, provide the following details:

| Field | Description | Default |
|-------|-------------|---------|
| Host | Server hostname or IP address | `localhost` |
| Port | Server port | `6379` |
| Password | Server password (if `requirepass` is set) | -- |
| Database | Database index (0-15 by default) | `0` |

### SSH Tunnels

You can connect to remote Redis instances through an SSH tunnel. Configure the SSH host, port, user, and authentication method (password or private key) in the connection dialog.

### SSL / TLS

SSL/TLS is not available for Redis connections in Zequel.

## Supported Features

### Key Browsing

Browse all keys in the selected Redis database. Keys are displayed in a navigable list with their types indicated.

### Supported Key Types

Zequel supports browsing and editing the following Redis data types:

| Type | Description |
|------|-------------|
| String | Simple key-value pairs. View and edit the string value. |
| List | Ordered collections of strings. View all elements in order. |
| Hash | Maps of field-value pairs. View and edit individual fields. |
| Set | Unordered collections of unique strings. View all members. |
| Sorted Set | Sets where each member has an associated score. View members with their scores. |

### TTL Management

View and modify the time-to-live (TTL) for any key. You can:

- View the remaining TTL on a key.
- Set a new TTL to make a key expire after a specified duration.
- Remove the TTL to make a key persistent.

## Limitations

The following features are **not available** for Redis:

- **SQL Query Editor** -- Redis uses its own command protocol.
- **SSL / TLS** -- Not available for Redis connections.
- **Tables / Columns / Views** -- Redis is a key-value store, not a relational database.
- **Foreign Keys / Indexes** -- Not applicable.
- **Routines / Triggers** -- Not applicable.
- **ER Diagrams** -- Not applicable.
- **Process Monitor** -- Not available.
- **Users** -- Not managed through Zequel for Redis.

## Data Operations

- **Browse** -- View keys and their values in a navigable interface.
- **Edit** -- Modify key values directly.
- **Import** -- Load data into Redis from external files.
- **Export** -- Export key data to various formats.
