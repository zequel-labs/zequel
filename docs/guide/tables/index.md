# Browsing Data

Zequel provides a high-performance data grid for browsing table contents. The grid uses virtual scrolling to handle tables with hundreds of thousands of rows without degrading performance.

## Opening a Table

To view a table's data, expand a connection in the sidebar tree and click on the table name. The table opens in a new tab in the main content area. Each open table gets its own tab, so you can switch between multiple tables quickly.

## The Data Grid

The data grid displays rows and columns in a spreadsheet-like layout. Key characteristics:

- **Virtual scrolling** -- Only the rows visible in the viewport (plus a small overscan buffer) are rendered to the DOM. This is powered by TanStack Virtual, which means scrolling through large result sets stays smooth regardless of the total row count.
- **Row height** -- Each row is a fixed 28 pixels tall, keeping the grid compact.
- **Alternating row colors** -- Odd rows have a subtle background tint to improve readability.
- **NULL values** -- Cells containing `NULL` are shown in muted italic text so they are easy to distinguish from empty strings.

## Column Sorting

Click any column header to cycle through sort states:

1. **Unsorted** -- A dimmed sort icon is displayed.
2. **Ascending** -- An upward arrow appears highlighted.
3. **Descending** -- A downward arrow appears highlighted.

Sorting is applied client-side to the current page of results. The sort icon in the header indicates the active sort direction.

## Column Filtering

Each column header contains a filter icon. Clicking it opens the **ColumnFilterPopover**, a popover with operator and value fields.

### Text columns

Available operators: Contains, Equals, Starts with, Ends with, IS NULL, IS NOT NULL.

### Numeric columns

Available operators: = (equals), != (not equals), > (greater than), < (less than), >= (greater or equal), <= (less or equal), IS NULL, IS NOT NULL.

For IS NULL and IS NOT NULL operators, no value input is needed. Type a value and press Enter or click **Apply** to activate the filter. Click **Clear** to remove it. An active filter is indicated by a highlighted filter icon with a small dot badge.

## Filter Panel

For more advanced filtering across multiple columns, use the **Filter Panel**. It supports building compound filter expressions with AND logic. Each filter row lets you select a column, choose an operator (including IN, NOT IN, LIKE, NOT LIKE, IS NULL, IS NOT NULL), and enter a value. Quick filter buttons are shown for the first few columns when no filters are active.

## Column Resize

Drag the right edge of any column header to resize it. The resize handle highlights when hovered. Columns have a minimum width of 50 pixels and a maximum of 800 pixels, with a default of 150 pixels.

## Column Reorder

Drag a column header by its grip handle (the vertical dots icon on the left side of the header) and drop it onto another column header to reorder columns. The dragged column is inserted at the drop target's position.

## Column Visibility

Columns can be hidden and shown. Use the column visibility controls to toggle individual columns on or off, or click **Show All** to reset visibility.

## Row Detail Panel

Click any row to activate it. The **RowDetailPanel** opens on the right side, displaying all columns for the selected row in a vertical list. Each field shows the column name, its data type, and the current value in an editable input.

The panel includes a search field at the top to quickly filter columns by name, which is useful for tables with many columns. Modified values are highlighted with a yellow indicator.

## Context Menu

Right-click any row to open a context menu with actions including:

- **Quick Look Editor** -- Open the CellValueViewer for the clicked cell.
- **Refresh** -- Reload the current data.
- **Copy / Paste** -- Copy selected rows, paste rows from clipboard.
- **Copy Cell Value** -- Copy just the value of the right-clicked cell.
- **Copy All Column Values** -- Copy every value in the right-clicked column.
- **Copy Rows As** -- Export selected rows as JSON, CSV, SQL INSERT, or tab-separated text.
- **Quick Filter** -- Filter by the clicked column's value.
- **Import** -- Import data from CSV or JSON files.
- **Export current page** -- Export the current page of data.
- **Delete** -- Mark selected rows for deletion.

## Next Steps

- [Editing rows](./editing-rows.md)
- [Managing columns](./columns.md)
- [Creating tables](./creating.md)
