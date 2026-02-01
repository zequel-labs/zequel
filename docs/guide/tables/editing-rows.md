# Editing Rows

Zequel supports in-place cell editing, a row editor dialog, row insertion, deletion, and full undo/redo. All changes are staged locally and applied to the database in a single batch when you click **Apply Changes**.

## In-Cell Editing

Double-click any cell in the data grid to enter edit mode. A text input appears inline, pre-filled with the current value. While editing:

- Press **Enter** or **Tab** to commit the edit and move on.
- Press **Escape** to cancel and discard the change.
- Click outside the cell (blur) to commit.

Edited cells are highlighted with a yellow background so you can see what has changed before applying.

### Special Values

- Typing `NULL` or `null` sets the cell value to `NULL`.
- Clearing the input on a nullable column also sets the value to `NULL`.
- Date and datetime values are formatted for editing and parsed back on commit.

## Row Editor Dialog

For a more structured editing experience, use the **RowEditorDialog**. This dialog is opened via the **Insert Row** action (from the toolbar or context menu) and presents a form with one field per column.

- Auto-increment columns are excluded from the form since the database populates them.
- Each field displays the column name, its type, and whether it is required (non-nullable).
- Nullable columns have a **NULL** checkbox to explicitly set the value to `NULL`.
- Text, blob, and JSON columns use a textarea for multi-line editing.
- Numeric, date, time, and datetime columns use appropriate input types.
- A **SQL Preview** toggle at the bottom shows the generated INSERT statement before you execute it.

## Adding New Rows

There are several ways to add a new row:

- Click the **Add Row** button in the grid toolbar.
- Right-click in the grid and select **Add Row** from the context menu.
- Use the keyboard shortcut **Cmd+I** (macOS).

New rows appear at the bottom of the grid with a green background. All columns default to `NULL` and can be edited in-cell before applying. New rows are part of the pending changes batch.

## Duplicating Rows

Select one or more rows and choose **Duplicate** from the context menu (or press **Cmd+D**). Duplicated rows are appended as new pending rows. Auto-increment primary key columns are automatically set to `NULL` so the database assigns fresh values.

## Deleting Rows

Select rows and press **Backspace** or choose **Delete** from the context menu. Deleted rows are shown with a red background and strikethrough text. Clicking delete again on an already-marked row unmarks it (toggle behavior).

For new rows that have not been saved, deletion removes them immediately from the pending additions.

## Multi-Row Selection

The grid supports multi-row selection for bulk operations:

- **Click** a row to select it (clears previous selection).
- **Cmd+Click** (macOS) or **Ctrl+Click** (Windows/Linux) to toggle individual rows in the selection.
- **Shift+Click** to select a contiguous range from the last active row to the clicked row.

The selection count is displayed in the toolbar when rows are selected. Selected rows are highlighted in blue.

## Bulk Operations

With multiple rows selected, you can:

- **Delete** all selected rows at once.
- **Duplicate** all selected rows.
- **Set Value** via the context menu to bulk-set a column's value for all selected rows to `NULL`, empty string, or `DEFAULT`.
- **Copy** selected rows to the clipboard in various formats.

## Undo and Redo

All edits, additions, and deletions can be undone and redone:

- **Cmd+Z** -- Undo the last change.
- **Cmd+Shift+Z** -- Redo the last undone change.
- Undo and redo buttons also appear in the pending changes toolbar.

The undo/redo system tracks cell edits, row additions, row deletions, and deletion unmarks as separate entries.

## Applying Changes

When any edits, additions, or deletions are pending, a yellow toolbar appears at the top of the grid showing the total number of changes, broken down by edits, new rows, and deletions.

- Click **Apply Changes** to send all pending changes to the database in one batch.
- Click **Discard** to throw away all pending changes and revert to the original data.

After applying, the grid refreshes automatically and the undo/redo history is cleared.

## Viewing Large Cell Values

For cells containing long text, JSON, XML, binary data, or images, click the expand icon that appears on hover (or use the **Quick Look Editor** from the context menu). This opens the **CellValueViewer** dialog, which provides:

- **View modes** -- Raw, Formatted (pretty-printed JSON or indented XML), Hex dump (for binary), and Image preview (for base64-encoded images).
- **Size indicator** -- Shows the byte size of the value.
- **Copy** -- Copy the displayed value to the clipboard.
- **Download** -- Save the value to a file with the appropriate extension.
- **Fullscreen** -- Expand the viewer to fill most of the screen.

## Next Steps

- [Browsing data](./index.md)
- [Managing columns](./columns.md)
- [Managing indexes](./indexes.md)
