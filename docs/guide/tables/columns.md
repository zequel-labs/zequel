# Columns

Zequel lets you view, add, modify, and drop columns through the **TableStructure** panel. This panel is accessible from the table view and displays column definitions in a tabular format.

## Viewing Columns

The Columns tab in the TableStructure panel lists every column in the table with the following details:

| Field | Description |
|-------|-------------|
| **Name** | The column name. |
| **Type** | The data type, including length or precision if applicable (e.g. `VARCHAR(255)`, `DECIMAL(10,2)`). |
| **Nullable** | Whether the column accepts NULL values (YES or NO). |
| **Default** | The default value, or `-` if none is set. |
| **Attributes** | Badges indicating PK (primary key), AI (auto increment), and UQ (unique). |

Each column row has **Edit** and **Drop** action buttons on the right side.

## Adding a Column

Click the **Add Column** button at the top of the Columns tab to open the **ColumnEditorDialog** in add mode.

### Fields

- **Column Name** -- The name for the new column.
- **Data Type** -- Select from the available types for the connected database engine. The type list is loaded dynamically, so it always matches the target database (PostgreSQL types for PostgreSQL connections, MySQL types for MySQL, etc.).
- **Length** -- Shown for types that support it (e.g. VARCHAR). A default length is applied automatically based on the type.
- **Precision / Scale** -- Shown for decimal/numeric types.
- **Constraints** -- Checkboxes for Primary Key, Auto Increment (enabled only when Primary Key is checked), Unique (disabled when Primary Key is checked), and Nullable (disabled when Primary Key is checked).
- **Default Value** -- Enable the checkbox and enter a value. Leave empty for a NULL default.
- **Position** -- For databases that support column ordering (e.g. MySQL), select where to place the column: at the end, first, or after a specific existing column.
- **Comment** -- An optional description for the column.

### SQL Preview

Click **Show SQL Preview** to see the generated `ALTER TABLE ... ADD COLUMN` statement before executing.

Click **Add Column** to execute. A success notification appears and the structure view refreshes automatically.

## Modifying a Column

Click the **Edit** icon next to any column to open the **ColumnEditorDialog** in edit mode. The form is pre-filled with the column's current definition. You can change:

- The column name.
- The data type, length, or precision.
- Nullable, unique, and default value settings.
- The column comment.

Click **Save Changes** to apply the modification.

## Dropping a Column

Click the **Drop** icon (trash icon) next to a column. A **ConfirmDeleteDialog** appears showing:

- A warning message stating the action cannot be undone.
- The SQL statement that will be executed (e.g. `ALTER TABLE "users" DROP COLUMN "email"`).
- A confirmation checkbox you must check before the **Drop** button becomes active.

After confirming, the column is dropped and the structure view refreshes.

## Next Steps

- [Managing indexes](./indexes.md)
- [Managing foreign keys](./foreign-keys.md)
- [Table info and DDL](./info.md)
