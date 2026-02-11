# Table Properties

The **Table Properties** tab displays detailed metadata, statistics, and the DDL (Data Definition Language) for a table or view. Open it by right-clicking a table or view in the sidebar and selecting **Properties**.

## Sections

The properties tab shows different sections depending on the database engine. All sections are read-only.

### General

Basic metadata about the table:

| Field | Description | Databases |
|-------|-------------|-----------|
| **Name** | Table or view name. | All |
| **Type** | `Table` or `View`. | All |
| **Schema** | Schema name. | PostgreSQL |
| **Database** | Database name. | MySQL, ClickHouse |
| **Owner** | Table owner. | PostgreSQL |
| **Engine** | Storage engine (e.g. InnoDB). | MySQL, ClickHouse |
| **Comment** | Table comment. | PostgreSQL, MySQL, ClickHouse |

### Storage (MySQL only)

Engine and storage details:

- **Engine** -- e.g. InnoDB, MyISAM.
- **Row Format** -- e.g. Dynamic, Compact.
- **Collation** -- e.g. utf8mb4_0900_ai_ci.
- **Character Set** -- e.g. utf8mb4.

### Keys & Partitioning (ClickHouse only)

ClickHouse-specific key information:

- **Partition Key**
- **Sorting Key**
- **Primary Key**
- **Sampling Key**

### Statistics

Size and row count information:

| Statistic | Databases |
|-----------|-----------|
| **Row Count** | All |
| **Total Size** / **Storage Size** | PostgreSQL, MySQL, MongoDB |
| **Table Size** | PostgreSQL |
| **Index Size** / **Total Index Size** | PostgreSQL, MongoDB |
| **Data Length** / **Total Bytes** | MySQL, ClickHouse |
| **Avg Object Size** / **Avg Row Length** | MySQL, MongoDB |
| **Page Count** / **Page Size** | SQLite |
| **Column Count** / **Index Count** | PostgreSQL |
| **Auto Increment** | MySQL |
| **Created** / **Updated** / **Metadata Modified** | MySQL, ClickHouse |
| **Indexes** / **Capped** | MongoDB |

### DDL

The full `CREATE TABLE` or `CREATE VIEW` statement displayed in a read-only Monaco editor. Click **Copy** to copy the DDL to the clipboard.

MongoDB collections do not have a DDL section.

## Refresh

Click the **Refresh** button in the top-right corner to reload all property data from the database.

## Tab Deduplication

Opening properties for the same table twice reuses the existing tab. Properties for tables and views with the same name open as separate tabs, as do tables in different schemas (PostgreSQL).

## Next Steps

- [Browsing data](./index.md)
- [Managing columns](./columns.md)
- [Managing indexes](./indexes.md)
- [Managing foreign keys](./foreign-keys.md)
