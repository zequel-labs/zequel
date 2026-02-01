# Table Info

The **TableInfo** panel displays metadata and the DDL (Data Definition Language) statement for a table.

## Viewing DDL

When you open the Table Info panel for a table, Zequel fetches the DDL / CREATE statement from the database and displays it in a read-only, monospaced code view. The DDL shows the exact statement needed to recreate the table, including all columns, types, constraints, indexes, and engine-specific options.

The DDL is fetched via the `schema.tableDDL` API, which calls the appropriate database-specific command (e.g. `SHOW CREATE TABLE` for MySQL, `pg_get_tabledef` or information schema queries for PostgreSQL, `.schema` for SQLite).

## Copying the DDL

Click the **Copy** button in the top-right corner of the panel to copy the full DDL statement to the clipboard. A brief "Copied!" confirmation appears after copying.

## Loading States

- While the DDL is being fetched, a spinning loader is displayed.
- If the fetch fails, an error message is shown in a highlighted error box with the specific error text.

## Refreshing

The DDL reloads automatically whenever the table name or connection changes. If you modify the table structure (add columns, create indexes, etc.), switching away and back to the Table Info panel will show the updated DDL.

## Next Steps

- [Browsing data](./index.md)
- [Managing columns](./columns.md)
- [Managing indexes](./indexes.md)
- [Managing foreign keys](./foreign-keys.md)
