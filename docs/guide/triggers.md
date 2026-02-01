# Triggers

Zequel lets you browse triggers defined on your database tables. Triggers are database objects that automatically execute a specified set of actions when certain events occur on a table, such as inserts, updates, or deletes.

## Viewing Triggers

1. Connect to a database and expand the schema in the sidebar.
2. Click the **Triggers** entry under the schema, or expand a table to see its associated triggers.
3. Click any trigger to view its definition.

## Trigger Details

When you select a trigger, Zequel displays the following information:

- **Name** -- The trigger's identifier.
- **Table** -- The table the trigger is attached to.
- **Event** -- The event that fires the trigger (INSERT, UPDATE, DELETE, or a combination).
- **Timing** -- Whether the trigger fires BEFORE or AFTER the event.
- **Definition** -- The full trigger body, displayed with syntax highlighting.

## Supported Databases

Triggers are available for:

- PostgreSQL -- Supports BEFORE, AFTER, and INSTEAD OF triggers, as well as per-row and per-statement triggers.
- MySQL -- Supports BEFORE and AFTER triggers on INSERT, UPDATE, and DELETE events.
- MariaDB -- Same trigger support as MySQL.
- SQLite -- Supports BEFORE, AFTER, and INSTEAD OF triggers.
