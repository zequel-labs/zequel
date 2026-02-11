# Writing Queries

Zequel includes a full-featured query editor built on [Monaco Editor](https://microsoft.github.io/monaco-editor/) -- the same engine that powers VS Code. It provides a rich editing experience tailored for SQL workflows.

## Editor Features

### Syntax Highlighting

The editor applies language-aware syntax highlighting for every supported database dialect. Keywords, identifiers, strings, numbers, and comments are all color-coded so you can scan queries at a glance.

### Auto-Complete

As you type, the editor suggests table names, column names, SQL keywords, and built-in functions based on the active connection's schema. Press **Tab** or **Enter** to accept a suggestion, or **Escape** to dismiss the menu.

### SQL Snippets

Zequel ships with over 30 built-in snippets for each SQL dialect. Type a short prefix and select the snippet from the suggestion list to expand a full statement template. Common snippets include:

- `sel` -- `SELECT ... FROM ...`
- `ins` -- `INSERT INTO ... VALUES ...`
- `upd` -- `UPDATE ... SET ... WHERE ...`
- `crt` -- `CREATE TABLE ...`
- `alt` -- `ALTER TABLE ...`

Snippets include tab stops so you can quickly jump between placeholder values with **Tab**.

### SQL Functions Library

The editor includes a built-in library of over 500 SQL functions organized by category (aggregate, string, math, date/time, window, JSON, and more). Functions are tailored to the active connection's dialect, so you see only functions supported by your database.

As you type a function name, the autocomplete menu shows matching functions with their signature and a brief description. This is useful when you cannot remember the exact name or argument order for a built-in function.

### Line Numbers

Line numbers are displayed in the left gutter by default, making it easy to reference specific lines when debugging errors or discussing queries.

### Minimap

A minimap is rendered on the right side of the editor, giving you a bird's-eye view of longer queries. Click anywhere on the minimap to jump to that section. The minimap can be toggled off in editor settings.

## Multi-Tab Support

You can open multiple query tabs to work on several queries at the same time. Each tab maintains its own editor content, cursor position, and result set.

### Opening a New Query Tab

There are several ways to open a new tab:

- Click the **"+"** button in the tab bar above the editor.
- Use the keyboard shortcut **Cmd+T** (macOS) or **Ctrl+T** (Windows/Linux).
- Select **File > New Query Tab** from the application menu.

Tabs are scoped to the active connection. When you switch connections, the tab bar updates to show only the tabs associated with that connection.

## Next Steps

- [Executing Queries](./executing.md) -- Run queries and view results.
- [Formatting SQL](./formatting.md) -- Auto-format your SQL for readability.
- [Saved Queries](./saved-queries.md) -- Save queries for reuse.
