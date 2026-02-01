# Indexes

Zequel provides tools to view, create, and drop indexes through the **TableStructure** panel.

## Viewing Indexes

Switch to the **Indexes** tab in the TableStructure panel. Each index is displayed with:

| Field | Description |
|-------|-------------|
| **Name** | The index name, shown with an icon for easy identification. |
| **Columns** | A comma-separated list of the columns included in the index. |
| **Type** | The index type (e.g. BTREE). |
| **Attributes** | Badges for PRIMARY (primary key index) and UNIQUE. |

Primary key indexes do not have a drop action, since they are managed through the column's primary key constraint.

## Creating an Index

Click the **Add Index** button at the top of the Indexes tab to open the **IndexEditorDialog**.

### Fields

- **Index Name** -- A name for the index. An auto-generated name is suggested based on the selected columns (e.g. `idx_users_email` or `uix_users_email` for unique indexes). You can override the generated name with a custom one.
- **Unique Index** -- Check this to create a unique index that prevents duplicate values. The auto-generated name prefix changes between `idx_` and `uix_` accordingly.
- **Columns** -- Click columns from the available list to add them to the index. Selected columns are shown in a numbered list above the available columns. Column order matters for index efficiency. Use the up/down arrows to reorder selected columns, or click the remove button to deselect a column.

### SQL Preview

Click **Show SQL Preview** to see the generated statement, for example:

```sql
CREATE UNIQUE INDEX "uix_users_email" ON "users" ("email")
```

Click **Create Index** to execute. The button is disabled until a name is provided and at least one column is selected.

## Dropping an Index

Click the **Drop** icon next to a non-primary index. A **ConfirmDeleteDialog** appears with:

- A warning that the action cannot be undone.
- The SQL statement (e.g. `DROP INDEX "idx_users_email"`).
- A confirmation checkbox.

After confirming, the index is dropped and the view refreshes.

## Next Steps

- [Managing columns](./columns.md)
- [Managing foreign keys](./foreign-keys.md)
- [Table info and DDL](./info.md)
