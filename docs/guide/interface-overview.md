# Interface Overview

Zequel uses a split-pane layout designed to keep your databases, queries, and results visible at the same time. This page describes each region of the workspace and how the panels interact.

## Layout Regions

The interface is divided into six primary regions, arranged left to right and top to bottom:

```
+---+------------+--------------------------------------+
|   |            |  Tab Bar                             |
|   |            +--------------------------------------+
| C |  Sidebar   |                                      |
| o |            |  Query Editor / Data Grid            |
| n | (database  |                                      |
| n |   tree)    +--------------------------------------+
| e |            |                                      |
| c |            |  Results Panel                       |
| t |            |                                      |
| . |            +--------------------------------------+
|   |            |  Status Bar                          |
+---+------------+--------------------------------------+
```

### Connection Rail

The connection rail is the narrow vertical bar along the left edge of the window. Each saved connection appears as an icon. Click a connection to activate it and populate the sidebar with its database objects. The **+** button at the top of the rail opens the new connection dialog.

You can have multiple connections open at the same time. The currently active connection is indicated by a highlight on its icon. Switching between connections updates the sidebar but does not close your open tabs.

### Sidebar

The sidebar displays the database tree for the active connection. The tree is organized hierarchically:

- **Database** (or schema, depending on the engine)
  - **Tables** -- click a table to open it in the data grid
  - **Views**
  - **Functions / Procedures** (where supported)
  - **Indexes**
  - **Other objects** (sequences, types, etc.)

Right-clicking any tree item opens a context menu with actions such as viewing structure, dropping objects, or importing data. You can collapse or expand the sidebar by dragging its edge or pressing **Cmd+B** (macOS) / **Ctrl+B** (Windows/Linux).

### Tab Bar

The tab bar sits along the top of the main content area. Every table you open and every query you write gets its own tab. Tabs can be reordered by dragging, and closed individually or in bulk via the context menu.

Press **Cmd+T** (macOS) / **Ctrl+T** (Windows/Linux) to open a new query tab. Press **Cmd+W** (macOS) / **Ctrl+W** (Windows/Linux) to close the current tab.

### Query Editor Panel

When a query tab is active, the upper portion of the main content area shows the Monaco-based query editor. The editor provides:

- **Syntax highlighting** for SQL dialects matching the active connection type.
- **Autocompletion** for table names, column names, and SQL keywords.
- **Multiple cursors** and standard Monaco editing features.
- **Execute** with **Cmd+Enter** (macOS) / **Ctrl+Enter** (Windows/Linux) to run the current statement or selected text.

The editor fills the available width and can be resized vertically by dragging the divider between it and the results panel.

### Results Panel

The results panel occupies the lower portion of the main content area. After running a query, this panel displays the result set in a virtual-scrolled data grid. Key capabilities:

- **Column sorting** -- click a column header to sort ascending or descending.
- **Column resizing** -- drag column edges to adjust width.
- **Inline editing** -- double-click a cell to modify its value when viewing table data.
- **Export** -- right-click to export the current result set as CSV, JSON, SQL, or Excel.

When viewing a table directly (rather than a query result), the results panel doubles as the data grid with full editing support.

### Status Bar

The status bar runs along the bottom of the window. It shows contextual information about the current tab:

- **Row count** -- total rows returned or loaded.
- **Execution time** -- how long the last query took.
- **Connection info** -- database engine, host, and database name.
- **Pending changes** -- when editing table data, the status bar shows the number of unsaved changes with **Apply** and **Discard** controls.

## Command Palette

Press **Cmd+K** (macOS) / **Ctrl+K** (Windows/Linux) to open the command palette. The palette provides fuzzy search across all available actions: switching connections, opening tables, running commands, and toggling settings. It is the fastest way to navigate large workspaces.

## Theme

Zequel supports dark and light themes. Toggle between them in the application settings. The theme applies to all interface regions including the Monaco editor.

## ER Diagrams

To view an entity-relationship diagram for your database, right-click a schema or database node in the sidebar and select **View ER Diagram**. The diagram renders table nodes with their columns and draws lines between tables based on foreign key relationships. You can pan and zoom the diagram canvas.

## Process Monitor

Access the process monitor from the command palette or the application menu. It displays a live list of active queries and connections on the current database server, allowing you to inspect long-running operations and terminate them if needed.

## Next Steps

- [Quick Start](/guide/quick-start) -- Walk through creating a connection and running your first query.
- [Introduction](/guide/) -- Review supported databases and feature highlights.
