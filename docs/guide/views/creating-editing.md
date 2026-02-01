# Creating and Editing Views

Zequel provides a View Editor Dialog for creating new views and editing existing ones. The dialog guides you through naming the view and writing the SELECT statement that defines it.

## Opening the View Editor

There are two ways to open the View Editor Dialog:

- **Create a new view** -- Click the **+** button next to the "Views" folder header in the sidebar. The dialog opens in create mode with empty fields.
- **Edit an existing view** -- Right-click a view in the sidebar and select **"Edit View"**. The dialog opens in edit mode with the view's current name and SELECT statement pre-filled.

## View Editor Fields

The View Editor Dialog contains the following fields:

| Field | Description |
|-------|-------------|
| **View Name** | The name for the view. In edit mode, this field is read-only because renaming a view requires dropping and recreating it. |
| **SELECT Statement** | The SQL SELECT query that defines the view's output. Enter only the SELECT statement itself -- do not include `CREATE VIEW` syntax. |
| **Replace if exists** | When checked, Zequel generates a `CREATE OR REPLACE VIEW` statement instead of `CREATE VIEW`. This is automatically enabled in edit mode. |

## Writing the SELECT Statement

Enter a valid SELECT statement in the text area. The statement can reference any tables, other views, functions, or subqueries available in the connected database. For example:

```sql
SELECT
  u.id,
  u.name,
  u.email,
  COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name, u.email
```

Do not include a trailing semicolon. Zequel wraps your statement in the appropriate `CREATE VIEW` syntax automatically.

## SQL Preview

Click **"Show SQL Preview"** at the bottom of the form to see the full SQL statement that Zequel will execute. The preview updates in real time as you type. This is useful for verifying the final DDL before saving.

For a view named `active_users` with "Replace if exists" enabled, the preview looks like:

```sql
CREATE OR REPLACE VIEW "active_users" AS
SELECT id, name, email FROM users WHERE active = true;
```

## Saving the View

Click **"Create View"** (or **"Update View"** in edit mode) to execute the statement against the database. If the operation succeeds, the sidebar refreshes and the new or updated view appears under the Views folder.

If the SQL is invalid or the database returns an error, an error message is displayed at the top of the dialog. Correct the SELECT statement and try again.

## Renaming a View

The view name cannot be changed through the editor. To rename a view, drop the existing view and create a new one with the desired name and the same SELECT statement.

## Next Steps

- [Managing Views](./) -- Browse and inspect views in the sidebar.
- [Materialized Views](./materialized) -- Create and refresh materialized views in PostgreSQL.
