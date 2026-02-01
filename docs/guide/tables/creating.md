# Creating Tables

Zequel provides a visual table builder through the **CreateTableDialog**. You can define the table name, add columns with types and constraints, and preview the generated SQL before executing.

## Opening the Dialog

Right-click on a database or schema node in the sidebar tree and select **Create Table**, or use the equivalent menu action. The dialog opens with a pre-populated `id` column (integer, primary key, auto increment) and one empty column row ready for input.

## Table Name and Comment

At the top of the dialog, enter:

- **Table Name** -- Required. Spaces are automatically replaced with underscores.
- **Comment** -- Optional. A description for the table.

## Defining Columns

Columns are defined in a tabular editor with the following fields per row:

| Field | Description |
|-------|-------------|
| **Name** | The column name. Spaces are replaced with underscores. |
| **Type** | Select from a searchable combobox of data types available for the connected database engine. Types are loaded dynamically. |
| **Length** | Shown for types that support a length parameter (e.g. VARCHAR). |
| **Primary Key** | Checkbox. Only one column can be the primary key at a time -- checking a new column unchecks the previous one. Setting a column as primary key also sets it to NOT NULL. |
| **Auto Increment** | Checkbox. Only enabled when the column is marked as primary key. |
| **Not Null** | Checkbox. Disabled and forced on for primary key columns. |
| **Unique** | Checkbox. Disabled for primary key columns (primary keys are inherently unique). |
| **Default** | A text field for the default value. Leave empty for no default. |

### Adding and Removing Columns

- Click the **Add Column** button to append a new column row.
- Click the trash icon at the right of a column row to remove it. At least one column must remain.

## SQL Preview

Click **Show SQL Preview** to see the complete `CREATE TABLE` statement that will be executed. For example:

```sql
CREATE TABLE "products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" VARCHAR(255) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The preview updates in real time as you modify the column definitions.

## Executing

Click **Create Table** to execute the statement. The button is disabled until a table name is provided and at least one column has a name. After successful creation, the sidebar tree refreshes to show the new table.

## Next Steps

- [Renaming and dropping tables](./rename-drop.md)
- [Managing columns](./columns.md)
- [Browsing data](./index.md)
