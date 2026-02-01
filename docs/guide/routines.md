# Routines

Routines in Zequel refer to stored procedures and functions defined in your database. The Routines view provides a convenient way to browse, inspect, and review their source code without writing manual queries against system catalogs.

## Opening the Routines View

1. Connect to a database and expand the schema in the sidebar.
2. Click the **Routines** entry under the schema. Stored procedures and functions are listed together.
3. Click any routine to view its details.

## Viewing Routine Source Code

When you select a routine, Zequel displays its full definition, including:

- **Name** -- The routine's identifier.
- **Type** -- Whether it is a stored procedure or a function.
- **Parameters** -- The input and output parameter list with data types.
- **Return type** -- The data type returned by the function (functions only).
- **Source code** -- The complete body of the routine, displayed in a syntax-highlighted code viewer.

The source code is rendered with SQL syntax highlighting so you can read through the logic comfortably.

## Supported Databases

Routines are available for database engines that support stored procedures or functions:

- PostgreSQL -- Functions and procedures.
- MySQL -- Stored procedures and functions.
- MariaDB -- Stored procedures and functions.
