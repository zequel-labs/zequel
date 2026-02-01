# Formatting SQL

Zequel can automatically format your SQL queries to improve readability and maintain a consistent style.

## How to Format

There are two keyboard shortcuts to format the current query:

- **Cmd+Shift+F** (macOS) or **Ctrl+Shift+F** (Windows/Linux)
- **Shift+Alt+F** on all platforms

You can also right-click inside the editor and select **Format Document** from the context menu.

Formatting applies to the entire contents of the active editor tab. If you have text selected, only the selected text is formatted.

## Formatter

Zequel uses the [sql-formatter](https://github.com/sql-formatter-org/sql-formatter) library to handle SQL formatting. It supports all of the SQL dialects available in Zequel, including PostgreSQL, MySQL, MariaDB, SQLite, and ClickHouse.

The formatter parses your SQL and rewrites it with consistent indentation, keyword casing, and line breaks. For example:

**Before:**

```sql
select id,name,email from users where active=true order by name asc limit 50
```

**After:**

```sql
SELECT
  id,
  name,
  email
FROM
  users
WHERE
  active = TRUE
ORDER BY
  name ASC
LIMIT
  50
```

## Formatting Options

You can customize the formatter behavior in **Settings > Editor > Formatting**. Available options include:

| Option | Description | Default |
|--------|-------------|---------|
| **Keyword case** | Transform keywords to `uppercase`, `lowercase`, or `preserve`. | `uppercase` |
| **Indent style** | Use `spaces` or `tabs` for indentation. | `spaces` |
| **Indent size** | Number of spaces per indent level (when using spaces). | `2` |
| **Comma position** | Place commas at the `end` of the line or at the `start` of the next line. | `end` |

Changes to formatting options take effect the next time you run the format command.

## Next Steps

- [Writing Queries](./index.md) -- Learn about the editor and its features.
- [Saved Queries](./saved-queries.md) -- Save and organize frequently used queries.
