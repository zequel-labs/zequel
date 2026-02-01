# Events

MySQL and MariaDB support scheduled events -- tasks that the database executes automatically on a defined schedule. Zequel provides a view for browsing these events and inspecting their definitions.

## Viewing Events

1. Connect to a MySQL or MariaDB database and expand the schema in the sidebar.
2. Click the **Events** entry under the schema.
3. A list of all scheduled events in the schema is displayed.

When you select an event, Zequel shows the following details:

- **Name** -- The event's identifier.
- **Status** -- Whether the event is enabled or disabled.
- **Schedule** -- The schedule expression (one-time with `AT` or recurring with `EVERY`).
- **Starts / Ends** -- The time window during which the event is active, if applicable.
- **Last executed** -- The timestamp of the most recent execution.
- **Definition** -- The full event body, displayed with syntax highlighting.

## About Scheduled Events

Scheduled events act as a built-in task scheduler within the database. They can execute SQL statements on a one-time or recurring basis. Common uses include purging old data, refreshing summary tables, and running periodic maintenance tasks.

Events require the MySQL Event Scheduler to be enabled on the server:

```sql
SET GLOBAL event_scheduler = ON;
```

## Supported Databases

Scheduled events are available for:

- MySQL
- MariaDB
