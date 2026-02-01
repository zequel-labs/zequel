# Query Results

After executing a query, the results are displayed in a grid panel at the bottom of the editor view.

## Results Grid

The results grid presents rows and columns in a tabular format. It uses virtual scrolling to handle large result sets efficiently -- only the rows currently visible on screen are rendered, so performance stays consistent regardless of how many rows are returned.

### Scrolling

- Scroll vertically to move through rows.
- Scroll horizontally to view columns that extend beyond the visible area.
- Use the scrollbar or trackpad gestures to navigate in either direction.

### Column Sorting

Click a column header to sort the result set by that column in ascending order. Click the same header again to switch to descending order. A third click removes the sort. Sorting is applied client-side to the returned result set and does not re-query the database.

## Row Count

The total number of rows returned by the query is displayed in the status bar at the bottom of the results panel. For queries that return no rows, the panel shows a message indicating that the query completed successfully with zero results.

## Execution Time

The time the query took to execute is shown alongside the row count in the status bar. This reflects the round-trip time from when the query was sent to when the last row was received, measured in milliseconds or seconds depending on duration.

## Multiple Result Sets

When you execute multiple statements in a single run, each statement that returns data produces its own result set. The results panel displays a set of tabs -- one for each result set -- so you can switch between them without re-running any queries.

Each tab is labeled with the statement index (e.g. "Result 1", "Result 2") so you can correlate results with the corresponding statement in the editor.

## Next Steps

- [Formatting SQL](./formatting.md) -- Format your queries for readability.
- [Query History](./history.md) -- Review and re-run previously executed queries.
