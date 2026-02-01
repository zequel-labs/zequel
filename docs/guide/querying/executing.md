# Executing Queries

Once you have written a query in the editor, Zequel provides several ways to run it and view results.

## Running a Query

Press **Cmd+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux) to execute the entire contents of the active editor tab. The query is sent to the database through the active connection, and results appear in the bottom panel once execution completes.

You can also click the **Run** button in the toolbar above the editor.

## Executing a Selection

If you only want to run part of your query, highlight the desired text and press **Cmd+Shift+Enter** (macOS) or **Ctrl+Shift+Enter** (Windows/Linux). Only the selected text will be sent to the database. This is useful when an editor tab contains multiple statements and you want to execute just one of them.

## Running Multiple Statements

The editor supports executing multiple SQL statements in a single run. Separate each statement with a semicolon (`;`). When you execute multiple statements:

1. Each statement is sent to the database in order.
2. A separate result set is returned for each statement that produces output.
3. You can switch between result sets using the tabs in the results panel.

If any statement fails, execution stops at the failing statement and an error message is displayed. Statements that ran before the failure are not rolled back unless you are inside an explicit transaction.

## Canceling a Running Query

To cancel a query that is taking longer than expected:

- Click the **Stop** button that appears in the toolbar while a query is in progress.
- Press **Cmd+.** (macOS) or **Ctrl+.** (Windows/Linux).

Cancellation sends a request to the database server to terminate the running query. The time it takes for cancellation to take effect depends on the database engine and the nature of the query.

## Keyboard Shortcut Summary

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Execute query | Cmd+Enter | Ctrl+Enter |
| Execute selection | Cmd+Shift+Enter | Ctrl+Shift+Enter |
| Cancel query | Cmd+. | Ctrl+. |

## Next Steps

- [Query Results](./results.md) -- Understand the results grid and how to work with output.
- [Query Plans](./query-plans.md) -- Visualize how the database executes your query.
