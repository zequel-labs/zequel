# Users

The Users view in Zequel lets you browse database users and roles. This is useful for reviewing who has access to your database and what privileges they hold.

## Opening the Users View

1. Connect to a database.
2. Click the **Users** entry in the sidebar.
3. The Users view opens, displaying a list of all database users and roles.

## User List

The user list shows key information about each user or role:

| Column         | Description                                         |
| -------------- | --------------------------------------------------- |
| **Name**       | The username or role name.                           |
| **Superuser**  | Whether the user has superuser privileges.           |
| **Can Login**  | Whether the role is allowed to log in.               |
| **Created**    | When the user or role was created, if available.     |

The available columns depend on the database engine. PostgreSQL exposes detailed role attributes, while MySQL and MariaDB provide user account information from their respective privilege systems.

## Supported Databases

The Users view is available for:

- PostgreSQL
- MySQL
- MariaDB
