# Query History

Zequel automatically logs every query you execute, so you always have a record of what you ran and when.

## Automatic Logging

Each time you run a query, it is recorded in the history with the following details:

- The full SQL text of the query.
- The timestamp when the query was executed.
- The connection it was run against.
- Whether the query succeeded or failed.

No configuration is needed -- history tracking is enabled by default.

## Viewing History

The query history is available in the **History** section of the sidebar. Entries are listed in reverse chronological order, with the most recent query at the top.

Each entry shows a preview of the SQL text and the time it was executed. Click an entry to expand it and see the full query.

## Re-Running a Historical Query

To re-run a query from your history:

1. Click the history entry in the sidebar.
2. The query is loaded into a new editor tab.
3. Press **Cmd+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux) to execute it.

This lets you quickly reproduce previous work without retyping anything.

## Clearing History

To remove all history entries:

1. Open the **History** section of the sidebar.
2. Click the **Clear History** button at the top of the section.
3. Confirm the action when prompted.

Clearing history is permanent and cannot be undone. Individual entries cannot be deleted separately -- clearing removes all entries at once.

## Next Steps

- [Saved Queries](./saved-queries.md) -- Save important queries as bookmarks for quick access.
- [Executing Queries](./executing.md) -- Learn about running and canceling queries.
