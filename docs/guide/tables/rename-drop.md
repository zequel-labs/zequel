# Renaming and Dropping Tables

Zequel provides dedicated dialogs for renaming and dropping tables, with SQL preview and confirmation safeguards.

## Renaming a Table

Right-click a table in the sidebar tree and select **Rename Table** to open the **RenameTableDialog**.

### How It Works

1. The dialog shows the current table name and a text field pre-filled with it.
2. Edit the name to the desired new value.
3. Optionally click **Show SQL Preview** to see the statement that will be executed, for example:

```sql
ALTER TABLE "orders" RENAME TO "customer_orders"
```

4. Click **Rename** to execute. The button is disabled if the name is unchanged or empty.

After renaming, the sidebar tree and any open tabs for the table update to reflect the new name.

## Dropping a Table

Right-click a table in the sidebar tree and select **Drop Table** to open the **ConfirmDeleteDialog**.

### Confirmation Flow

Dropping a table permanently deletes all of its data, indexes, and constraints. The confirmation dialog includes several safeguards:

1. **Warning message** -- A prominent alert explains that the action cannot be undone and may result in permanent data loss.
2. **SQL preview** -- Optionally view the `DROP TABLE` statement that will be executed.
3. **Confirmation checkbox** -- You must check the "I understand this action cannot be undone and may result in permanent data loss" checkbox before the **Drop** button becomes active.

The **Drop** button uses a destructive (red) style to further signal the severity of the action.

After confirming, the table is dropped, any open tabs for it are closed, and the sidebar tree refreshes.

## Next Steps

- [Creating tables](./creating.md)
- [Table info and DDL](./info.md)
- [Browsing data](./index.md)
