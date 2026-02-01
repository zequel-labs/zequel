# Materialized Views

Materialized views are a PostgreSQL feature that stores the result of a query physically on disk. Unlike standard views, which execute their SELECT statement on every access, materialized views cache the data and must be explicitly refreshed to reflect changes in the underlying tables.

Zequel provides a dedicated interface for browsing and refreshing materialized views.

## Database Support

Materialized views are supported only for **PostgreSQL** connections. They do not appear in the sidebar for MySQL, MariaDB, SQLite, ClickHouse, MongoDB, or Redis connections.

## Browsing Materialized View Data

When you open a materialized view, Zequel displays the cached data in a read-only table grid. The header shows the view name, a "Materialized View" badge, the schema name (if applicable), and a population status badge:

- **Populated** -- The view contains data from a previous refresh.
- **Not Populated** -- The view has been created but has never been refreshed, so it contains no data.

## Refreshing a Materialized View

Because the data in a materialized view is a snapshot, it can become stale as the underlying tables change. To update the data:

1. Open the materialized view.
2. Click the **"Refresh Data"** button in the header bar.
3. Zequel executes `REFRESH MATERIALIZED VIEW` and reloads the data grid.

A success notification confirms when the refresh is complete. If the refresh fails (for example, due to a permission error or a problem with the underlying query), an error message is displayed.

### Concurrent Refresh

Check the **"Concurrent"** checkbox before clicking "Refresh Data" to perform a concurrent refresh. This executes `REFRESH MATERIALIZED VIEW CONCURRENTLY`, which allows read queries to continue while the view is being refreshed.

Concurrent refresh requires that the materialized view has at least one unique index. If no unique index exists, PostgreSQL will return an error.

## Reloading Metadata

Click the **"Reload"** button to re-fetch the materialized view metadata and data from the database without performing a full refresh. This is useful when another user or process has refreshed the view and you want to see the updated data in Zequel.

## Limitations

- Materialized views are read-only. You cannot edit cell values directly in the data grid.
- The data grid displays up to 1,000 rows. To view more data or apply filters, use a query tab with a custom SELECT statement against the materialized view.
- Creating and dropping materialized views is done through the query editor using standard PostgreSQL DDL (`CREATE MATERIALIZED VIEW`, `DROP MATERIALIZED VIEW`).

## Next Steps

- [Managing Views](./) -- Work with standard views in the sidebar.
- [Creating and Editing Views](./creating-editing) -- Create standard views using the View Editor Dialog.
