# Creating a Connection

Zequel supports connecting to PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, and Redis. All connections are configured through a unified connection form.

## Opening the Connection Form

You can create a new connection in two ways:

- Click the **"New Connection"** button in the sidebar.
- Click **"New Connection"** on the welcome screen that appears when no connections are active.

## Connection Fields

The connection form includes the following fields:

| Field | Description | Required |
|-------|-------------|----------|
| **Name** | A display name for the connection (e.g. "Production DB"). | Yes |
| **Type** | The database engine: PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, or Redis. | Yes |
| **Host** | The hostname or IP address of the database server (e.g. `localhost`, `db.example.com`). | Yes (except SQLite) |
| **Port** | The port number. A default is filled in based on the selected database type. | Yes (except SQLite) |
| **Username** | The database user to authenticate as. | Depends on type |
| **Password** | The password for the database user. | Depends on type |
| **Database** | The name of the database to connect to. For SQLite, this is the file path. | Depends on type |
| **Color** | An optional color label to visually distinguish the connection in the sidebar. | No |

### Default Ports

When you select a database type, the port field is automatically set to the standard default:

- **PostgreSQL** -- 5432
- **MySQL / MariaDB** -- 3306
- **ClickHouse** -- 8123
- **MongoDB** -- 27017
- **Redis** -- 6379
- **SQLite** -- not applicable (file-based)

## Saving a Connection

After filling in the required fields, click **"Save"** to store the connection. Zequel saves your credentials securely using the operating system keychain via keytar, so passwords are never stored in plain text on disk.

Once saved, the connection appears in the sidebar and can be opened at any time by clicking on it.

## Editing a Connection

To edit an existing connection, right-click it in the sidebar and select **"Edit Connection"**. The connection form will open with the current values pre-filled. Make your changes and click **"Save"** to update.

## Deleting a Connection

To remove a connection, right-click it in the sidebar and select **"Delete Connection"**. You will be prompted to confirm before the connection and its stored credentials are permanently removed.

## Next Steps

- [Import a connection from a URL](./import-url.md)
- [Configure an SSH tunnel](./ssh-tunnels.md)
- [Enable SSL/TLS](./ssl-tls.md)
- [Organize connections into folders](./folders.md)
- [Test a connection before saving](./testing.md)
