# Extensions

PostgreSQL has a rich extension system that adds functionality beyond the core database engine. Zequel provides a dedicated view for browsing installed extensions and an Extension Manager dialog for installing or removing them.

## Viewing Extensions

1. Connect to a PostgreSQL database.
2. Click the **Extensions** entry in the sidebar.
3. A list of all installed extensions is displayed, along with their versions and descriptions.

Each extension entry shows:

- **Name** -- The extension identifier (e.g., `pg_stat_statements`, `uuid-ossp`, `postgis`).
- **Version** -- The currently installed version.
- **Description** -- A brief summary of what the extension provides.

## Installing an Extension

1. Click the **Manage Extensions** button in the toolbar to open the Extension Manager dialog.
2. The dialog lists all extensions available on the server, including those that are not yet installed.
3. Find the extension you want to install and click **Install**.
4. Zequel executes the `CREATE EXTENSION` statement and the extension appears in the installed list.

> Installing an extension requires the appropriate privileges on the database, typically superuser or a role with the `CREATE` privilege on the target schema.

## Removing an Extension

1. Open the Extension Manager dialog.
2. Locate the installed extension you want to remove.
3. Click **Remove**.
4. Zequel executes `DROP EXTENSION` and the extension is removed from the database.

> Removing an extension may drop objects that depend on it. Review dependencies carefully before removing an extension on a production database.

## Supported Databases

Extensions are specific to PostgreSQL:

- PostgreSQL
