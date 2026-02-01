# Quick Start

This guide walks you through creating your first database connection, running a query, and browsing table data. The entire process takes less than two minutes.

## Prerequisites

- Zequel is installed on your machine. If not, see [Installation](/guide/installation).
- You have access to a running database (PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, or Redis).

## Step 1: Create a Connection

1. Launch Zequel. You will land on the home screen with an empty workspace.
2. Click the **+** button on the connection rail (the narrow bar along the left edge of the window) to open the new connection dialog.
3. Select your database type from the list.
4. Fill in the connection details:
   - **Name** -- A label for this connection (e.g., "Local PostgreSQL").
   - **Host** -- The hostname or IP address (e.g., `localhost`).
   - **Port** -- The default port is pre-filled for each database type.
   - **User** and **Password** -- Your database credentials.
   - **Database** -- The specific database or schema to connect to.
5. For SQLite, provide the file path to your `.db` or `.sqlite` file instead of host and port.
6. Click **Test Connection** to verify that Zequel can reach your database. A success message confirms the connection is valid.
7. Click **Save** to store the connection.

> For databases behind a firewall or bastion host, expand the **SSH Tunnel** section and provide your SSH credentials. Zequel also supports **SSL/TLS** connections -- toggle the SSL option and provide your certificates if required.

## Step 2: Connect and Explore

1. Click the connection you just saved on the connection rail. Zequel will establish the connection and display the database tree in the sidebar.
2. Expand the tree to see schemas, tables, views, and other objects.
3. Click any table name to open it in the data grid. The grid loads rows on demand using virtual scrolling, so even large tables are responsive.

## Step 3: Run a Query

1. Click the **+** tab button in the tab bar or press **Cmd+T** (macOS) / **Ctrl+T** (Windows/Linux) to open a new query tab.
2. Type a SQL statement in the Monaco editor. For example:
   ```sql
   SELECT * FROM users LIMIT 100;
   ```
3. Press **Cmd+Enter** (macOS) / **Ctrl+Enter** (Windows/Linux) to execute the query.
4. Results appear in the results panel below the editor. You can resize the split between the editor and results by dragging the divider.

## Step 4: Edit Data Inline

1. Open a table in the data grid by clicking its name in the sidebar.
2. Double-click any cell to enter edit mode.
3. Modify the value and press **Enter** to confirm, or **Escape** to cancel.
4. Changed cells are highlighted. Click **Apply** in the status bar to commit all pending changes to the database, or **Discard** to revert them.

## Step 5: Import and Export

- To **export** query results or table data, right-click the results panel and choose an export format: CSV, JSON, SQL, or Excel.
- To **import** data into a table, right-click the table name in the sidebar and select **Import Data**, then choose your file.

## Next Steps

- [Interface Overview](/guide/interface-overview) -- Learn how the workspace is organized and how to navigate it efficiently.
- [Introduction](/guide/) -- Review the full list of supported databases and features.
