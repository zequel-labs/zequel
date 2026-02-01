# Command Palette

The command palette is a quick-access search interface that lets you find and execute actions, open views, and navigate your workspace without leaving the keyboard.

## Opening the Command Palette

Press **Cmd+K** (macOS) / **Ctrl+K** (Windows/Linux) to open the command palette. A search input appears at the top of the window, ready for you to type.

## Using the Palette

1. Start typing to filter the list of available commands. The palette uses fuzzy matching, so you do not need to type the exact command name -- partial matches and abbreviations work.
2. Use the **Up** and **Down** arrow keys to navigate through the results.
3. Press **Enter** to execute the highlighted command.
4. Press **Escape** to close the palette without executing anything.

## Available Commands

The command palette provides access to a wide range of actions, including:

- **Navigation** -- Jump to tables, views, routines, triggers, and other schema objects by name.
- **Bookmarks** -- Open a saved bookmark directly from the palette.
- **Views** -- Switch to the ER Diagram, Processes, Users, or other views.
- **Settings** -- Open the settings panel.
- **Tab management** -- Create a new tab, close the current tab, or switch between open tabs.
- **Query actions** -- Execute, format, or save the current query.

The list of commands updates dynamically based on your current connection and context. For example, database-specific schema objects only appear when you are connected to a database.

## Tips

- The command palette is the fastest way to navigate a large schema. Instead of scrolling through the sidebar tree, type the table or view name directly.
- Fuzzy matching means you can type fragments like "usr" to match "users" or "user_accounts."
- Combine the palette with keyboard shortcuts for a fully keyboard-driven workflow.
