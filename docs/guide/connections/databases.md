# Managing Databases

Zequel includes a Database Manager dialog that lets you create and drop databases directly from the application, without writing SQL manually.

## Opening the Database Manager

1. Connect to a database server (see [Creating a Connection](./index.md)).
2. Once connected, open the **Database Manager** from the connection's context menu or toolbar.

The dialog lists all databases on the connected server that the current user has permission to see.

## Creating a Database

1. In the Database Manager dialog, click **"Create Database"**.
2. Enter a name for the new database.
3. Confirm the creation.

The new database appears in the list and can be selected as the active database.

### Naming Rules

Database names must follow the rules of the underlying database engine. In general:

- Use letters, numbers, and underscores.
- Avoid spaces and special characters.
- Some engines are case-sensitive; others are not. Check your database documentation if unsure.

## Dropping a Database

1. In the Database Manager dialog, locate the database you want to remove.
2. Click **"Drop"** next to the database name.
3. Confirm the action.

::: danger
Dropping a database permanently deletes all data, tables, and objects within it. This action cannot be undone. Make sure you have a backup before proceeding.
:::

## Switching Databases

From the Database Manager or the sidebar, you can switch the active database for your current connection. This changes the context for all subsequent queries and schema browsing without needing to disconnect and reconnect.

## Supported Engines

Database creation and deletion through the Database Manager is available for:

- PostgreSQL
- MySQL
- MariaDB
- ClickHouse
- MongoDB

For **SQLite**, databases are file-based. Creating a new SQLite database means specifying a new file path in the connection form.

For **Redis**, the concept of a database is a numbered index (e.g. `0`--`15`). Redis databases are not created or dropped through the Database Manager; select the database index in the connection form instead.

## Required Permissions

Creating and dropping databases requires the appropriate privileges on the server. If the operation fails with a permission error, confirm that the connected user has the necessary role or grant:

- **PostgreSQL** -- `CREATEDB` privilege or superuser role.
- **MySQL / MariaDB** -- `CREATE` and `DROP` privileges.
- **ClickHouse** -- Depends on the user profile and access control configuration.
- **MongoDB** -- Write access or the `dbAdmin` role.
