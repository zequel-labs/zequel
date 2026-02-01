# Query Plans

Zequel can visualize how the database engine executes a query by displaying the output of `EXPLAIN` in a structured view. This helps you identify performance bottlenecks and understand how your queries are processed.

## Running EXPLAIN

To generate a query plan, prefix your query with `EXPLAIN` (or `EXPLAIN ANALYZE` for actual execution statistics):

```sql
EXPLAIN SELECT * FROM users WHERE email = 'user@example.com';
```

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE total > 100 ORDER BY created_at DESC;
```

Run the query as you normally would with **Cmd+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux). When Zequel detects that the result is an execution plan, it renders the output in the QueryPlanView component instead of the standard results grid.

## The QueryPlanView Component

The QueryPlanView presents the execution plan as a structured breakdown of the operations the database performs. Depending on the database engine, this may include:

- **Node type** -- The operation at each step (e.g. Sequential Scan, Index Scan, Hash Join, Sort).
- **Relation** -- The table or index being accessed.
- **Estimated cost** -- The planner's cost estimate for each operation (startup cost and total cost).
- **Estimated rows** -- The number of rows the planner expects each step to produce.
- **Actual time** -- The real execution time for each step (available with `EXPLAIN ANALYZE`).
- **Actual rows** -- The real row count at each step (available with `EXPLAIN ANALYZE`).

## Understanding Plan Output

### Sequential Scan vs. Index Scan

A **Sequential Scan** (or Full Table Scan) reads every row in the table. An **Index Scan** uses an index to locate rows directly. If you see a sequential scan on a large table with a `WHERE` clause, adding an index on the filtered column may improve performance.

### Joins

Join nodes show how two data sources are combined. Common join strategies include:

- **Nested Loop** -- Iterates over one input and probes the other for each row. Efficient for small inputs or indexed lookups.
- **Hash Join** -- Builds a hash table from one input and probes it with the other. Good for larger, unsorted inputs.
- **Merge Join** -- Merges two sorted inputs. Efficient when both inputs are already sorted on the join key.

### Sort and Limit

A **Sort** node indicates the database is sorting rows, which can be expensive for large data sets. A **Limit** node truncates the output to a specified number of rows.

### Cost Estimates

Cost values are expressed in arbitrary units defined by the database planner. They are useful for comparing the relative expense of different operations within the same plan, but not meaningful as absolute measurements.

## Database-Specific Notes

The format and detail level of `EXPLAIN` output varies by database:

- **PostgreSQL** -- Supports `EXPLAIN`, `EXPLAIN ANALYZE`, and `EXPLAIN (FORMAT JSON)` for detailed output.
- **MySQL / MariaDB** -- Supports `EXPLAIN` and `EXPLAIN ANALYZE` (MySQL 8.0.18+). Output is returned in a tabular format.
- **SQLite** -- Supports `EXPLAIN QUERY PLAN` for a simplified plan overview.
- **ClickHouse** -- Supports `EXPLAIN` with multiple modes including `EXPLAIN PLAN` and `EXPLAIN PIPELINE`.

## Next Steps

- [Executing Queries](./executing.md) -- Learn how to run and cancel queries.
- [Query Results](./results.md) -- Understand the results grid and output panel.
