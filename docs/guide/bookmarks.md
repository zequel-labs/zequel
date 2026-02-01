# Bookmarks

Bookmarks let you save frequently used SQL queries for quick access. Instead of rewriting or searching through your history, you can bookmark a query and open it again with a single click.

## Saving a Bookmark

1. Write a query in the editor.
2. Press **Cmd+S** (macOS) / **Ctrl+S** (Windows/Linux), or click the **Save** button in the editor toolbar.
3. Enter a name for the bookmark in the dialog that appears.
4. Click **Save**. The query is stored locally and associated with the current connection.

## Accessing Bookmarks

Saved bookmarks are accessible from the sidebar. Click the **Bookmarks** section to expand the list of saved queries. Click any bookmark to open it in a new query tab with the saved SQL pre-loaded in the editor.

You can also find bookmarks through the command palette (Cmd+K / Ctrl+K) by typing the bookmark name.

## Managing Bookmarks

- **Rename** -- Right-click a bookmark in the sidebar and select **Rename** to change its label.
- **Delete** -- Right-click a bookmark and select **Delete** to remove it permanently.

## Storage

Bookmarks are stored locally on your machine. They persist across application restarts and are tied to individual connections, so each connection maintains its own set of saved queries.

## Tips

- Use descriptive names for bookmarks so they are easy to find later (e.g., "Monthly revenue report" rather than "Query 1").
- Bookmarks are searchable through the command palette, making them a fast way to switch between common queries.
