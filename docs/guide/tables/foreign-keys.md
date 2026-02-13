# Foreign Keys

Zequel lets you view, create, and drop foreign key constraints through the **TableStructure** panel.

## Viewing Foreign Keys

Switch to the **Foreign Keys** tab in the TableStructure panel. Each foreign key displays:

| Field | Description |
|-------|-------------|
| **Name** | The constraint name, shown with a link icon. |
| **Column** | The source column in the current table. |
| **References** | The referenced table and column, shown as `table.column`. |
| **On Update** | The referential action on update (e.g. NO ACTION, CASCADE). |
| **On Delete** | The referential action on delete (e.g. NO ACTION, CASCADE, SET NULL). |

If the table has no foreign keys, a "No foreign keys found" message is shown.

## Creating a Foreign Key

Click the **Add Foreign Key** button at the top of the Foreign Keys tab to open the **ForeignKeyEditorDialog**.

### Fields

- **Constraint Name** -- A name for the foreign key. An auto-generated name is suggested based on the source table, columns, and referenced table (e.g. `fk_orders_user_id_users`). You can override it.
- **Source Columns** -- Click columns from the current table to select them as source columns. Selected columns appear as chips above the column list. Click the remove button on a chip to deselect.
- **Referenced Table** -- Select the target table from a dropdown. The list shows all tables in the current database.
- **Referenced Columns** -- After selecting a referenced table, its columns are loaded. Click columns to map them to the source columns in order. The dialog shows the mapping (e.g. `user_id -> id`). The number of referenced columns must match the number of source columns.
- **ON UPDATE** -- The action to take when the referenced row is updated. Options: NO ACTION, CASCADE, SET NULL, SET DEFAULT, RESTRICT.
- **ON DELETE** -- The action to take when the referenced row is deleted. Same options as ON UPDATE.

### SQL Preview

Click **Show SQL Preview** to see the generated statement, for example:

```sql
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user_id_users"
  FOREIGN KEY ("user_id")
  REFERENCES "users" ("id")
  ON UPDATE NO ACTION
  ON DELETE CASCADE
```

Click **Add Foreign Key** to execute. The button is disabled until all required fields are filled and the source/referenced column counts match.

## Dropping a Foreign Key

Click the **Drop** icon next to a foreign key. A **ConfirmDeleteDialog** appears with:

- A warning that the action cannot be undone.
- The SQL statement (e.g. `ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_user_id_users"`).
- A confirmation checkbox.

After confirming, the constraint is dropped and the view refreshes.

## Navigating Foreign Keys

When browsing table data in the data grid, columns that are part of a foreign key display a blue link icon next to each value. Clicking the icon opens a **new tab** with the referenced table, automatically filtered to the matching row.

For example, if the `orders` table has a foreign key from `user_id` to `users.id`, clicking the link icon on a `user_id` value of `42` opens the `users` table filtered to `id = 42`.

### Behavior

- Each click opens a new tab, even if the same referenced table is already open (because each tab carries a different filter).
- `NULL` values do not display the navigation icon.
- FK navigation is supported on **PostgreSQL**, **MySQL**, **MariaDB**, **SQLite**, **DuckDB**, and **SQL Server**. ClickHouse, MongoDB, and Redis do not support foreign keys.

## Next Steps

- [Managing columns](./columns.md)
- [Managing indexes](./indexes.md)
- [Table properties](./info.md)
