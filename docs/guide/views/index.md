# Managing Views

Views appear in the sidebar alongside tables when you are connected to a database. Zequel lists standard views for all supported SQL database engines and materialized views for PostgreSQL.

## Viewing Views in the Sidebar

After connecting to a database, expand the **Views** folder in the sidebar tree. Each view is displayed with a purple eye icon to distinguish it from tables. The Views folder only appears when the database contains at least one view.

You can filter views by typing in the sidebar search field. The filter applies to both table and view names simultaneously.

## Viewing View Data

Click a view name in the sidebar to open its data in the main panel. Zequel executes the underlying SELECT statement and displays the results in the same virtual-scrolled data grid used for tables.

You can also right-click a view and select **"View Data"** from the context menu to open it in a dedicated tab.

## Querying a View

Right-click a view in the sidebar and choose **"Query View"** to open a new query tab with a pre-filled `SELECT * FROM "view_name" LIMIT 100;` statement. You can edit this query before executing it.

## Viewing the View Definition

To inspect the SQL definition (DDL) of a view, right-click the view in the sidebar and select **"Edit View"**. The View Editor Dialog opens with the view's name and its underlying SELECT statement displayed in the form fields.

## Copying View Information

The context menu on each view provides two copy options:

- **Copy Name** -- copies the view name to the clipboard.
- **Copy SELECT Statement** -- copies a `SELECT * FROM "view_name";` statement to the clipboard.

## Dropping a View

To drop a view, right-click it in the sidebar and select **"Drop View"**. A confirmation dialog will appear before the view is permanently removed from the database.

## Next Steps

- [Creating and Editing Views](./creating-editing) -- Learn how to create new views or modify existing ones.
- [Materialized Views](./materialized) -- Work with PostgreSQL materialized views, including data refresh.
