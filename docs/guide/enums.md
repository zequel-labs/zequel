# Enums

PostgreSQL supports custom enumerated types (enums) that define a fixed set of allowed values for a column. Zequel provides a view for browsing these enum types and inspecting their values.

## Viewing Enums

1. Connect to a PostgreSQL database and expand the schema in the sidebar.
2. Click the **Enums** entry under the schema.
3. A list of all custom enum types in the schema is displayed.

When you select an enum, Zequel shows:

- **Name** -- The enum type's identifier.
- **Schema** -- The schema the enum belongs to.
- **Values** -- The ordered list of allowed values defined for the enum.

## How Enums Are Used

Enum types in PostgreSQL let you constrain a column to a specific set of string values at the type level. For example, a `status` column might use an enum with values like `active`, `inactive`, and `archived`. This is enforced by the database, providing stronger guarantees than a check constraint.

Enums are defined with `CREATE TYPE`:

```sql
CREATE TYPE status AS ENUM ('active', 'inactive', 'archived');
```

Columns that use the enum type will only accept values from the defined list.

## Supported Databases

Custom enum types are specific to PostgreSQL:

- PostgreSQL
