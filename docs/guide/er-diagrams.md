# ER Diagrams

Zequel includes an interactive entity-relationship (ER) diagram viewer that visualizes table relationships in your database. The diagram is powered by Vue Flow and provides a graphical overview of your schema, making it easier to understand how tables are connected through foreign keys.

## Opening the ER Diagram

1. Connect to a database and select a schema from the sidebar.
2. Click the **ER Diagram** entry in the sidebar or use the command palette (Cmd+K / Ctrl+K) to search for it.
3. Zequel reads the schema metadata and renders a diagram with all tables and their relationships.

## Reading the Diagram

Each table appears as a node displaying the table name and its columns. Foreign key relationships are drawn as edges connecting the referencing column to the referenced column in another table. Primary key columns are visually distinguished so you can identify them at a glance.

- **Nodes** represent tables. Each node lists the table's columns along with their data types.
- **Edges** represent foreign key constraints. An edge connects the source column to the target column it references.

## Navigation

The diagram canvas supports standard navigation controls:

- **Pan** -- Click and drag on an empty area of the canvas to move around.
- **Zoom** -- Use the scroll wheel or trackpad pinch gesture to zoom in and out. Zoom controls are also available in the toolbar.
- **Fit to view** -- Click the fit-to-view button in the toolbar to center and scale the diagram so all tables are visible.

## Mini-Map

A mini-map is displayed in the corner of the diagram canvas. It shows a scaled-down overview of the entire diagram and highlights the currently visible viewport. Click and drag within the mini-map to quickly navigate to a different area of the schema.

## Auto-Layout

Zequel uses ELK.js (Eclipse Layout Kernel) to automatically arrange tables in a readable layout. When the diagram first loads, ELK.js calculates optimal positions for all nodes to minimize edge crossings and provide clear visual separation between tables.

If you rearrange nodes manually and want to reset the layout, click the **Auto Layout** button in the toolbar to re-run the ELK.js layout algorithm.

## Supported Databases

ER diagrams are available for all relational databases that support foreign key constraints:

- PostgreSQL
- MySQL
- MariaDB
- SQLite
- ClickHouse

## Tips

- For large schemas with many tables, use the mini-map to orient yourself and the fit-to-view button to get an overview.
- Hover over an edge to highlight the relationship and see which columns are involved.
- The diagram reflects the current state of the schema. If you make structural changes to the database, reopen the diagram to see the updated relationships.
