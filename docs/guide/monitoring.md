# Monitoring

The process monitor in Zequel provides a real-time view of active database connections and running queries. Use it to identify long-running queries, diagnose performance issues, or terminate problematic processes.

## Opening the Process Monitor

1. Connect to a database.
2. Click the **Processes** entry in the sidebar, or use the command palette (Cmd+K / Ctrl+K) and search for "Processes."
3. The process monitor view opens, displaying a table of all active connections and queries on the server.

## Process List

The process list displays information about each active connection, including:

| Column        | Description                                       |
| ------------- | ------------------------------------------------- |
| **PID**       | The process or connection identifier.              |
| **User**      | The database user associated with the connection.  |
| **Database**  | The database the process is connected to.          |
| **State**     | The current state of the process (active, idle, etc.). |
| **Query**     | The SQL statement currently being executed, if any. |
| **Duration**  | How long the current query or connection has been running. |

The exact columns vary depending on the database engine. Zequel normalizes the output so the layout is consistent across PostgreSQL, MySQL, and MariaDB.

## Killing a Process

If a query is stuck or consuming excessive resources, you can terminate it directly from the process monitor:

1. Locate the process in the list.
2. Click the **Kill** button on the row.
3. Confirm the action in the dialog that appears.

Zequel sends the appropriate termination command for the database engine (for example, `pg_terminate_backend()` on PostgreSQL or `KILL` on MySQL/MariaDB).

> Killing a process will immediately terminate the connection and roll back any uncommitted transactions. Use this with caution on production databases.

## Refreshing

The process list can be refreshed manually by clicking the **Refresh** button in the toolbar. This fetches the latest snapshot of active processes from the server.

## Supported Databases

The process monitor is available for database engines that expose process or connection information:

- PostgreSQL
- MySQL
- MariaDB
