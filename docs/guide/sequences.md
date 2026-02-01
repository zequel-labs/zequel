# Sequences

Sequences are database objects that generate ordered numeric values, commonly used for auto-incrementing primary keys. Zequel provides a dedicated view for browsing and creating sequences in PostgreSQL.

## Viewing Sequences

1. Connect to a PostgreSQL database and expand the schema in the sidebar.
2. Click the **Sequences** entry under the schema.
3. A list of all sequences in the schema is displayed, showing key properties for each.

The sequence list includes the following details:

| Property        | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Name**        | The sequence identifier.                              |
| **Start value** | The initial value of the sequence.                    |
| **Min value**   | The minimum value the sequence can reach.             |
| **Max value**   | The maximum value the sequence can reach.             |
| **Increment**   | The step size between consecutive values.             |
| **Current value** | The last value returned by the sequence.            |
| **Cycle**       | Whether the sequence wraps around after reaching its limit. |

## Creating a Sequence

1. Click the **Create Sequence** button in the toolbar to open the Create Sequence dialog.
2. Fill in the sequence properties:
   - **Name** -- A unique name for the sequence within the schema.
   - **Start value** -- The first value the sequence will produce.
   - **Increment** -- How much the value increases (or decreases) with each call.
   - **Min value** and **Max value** -- Optional bounds for the sequence.
   - **Cycle** -- Toggle this on if the sequence should restart from the minimum value after reaching the maximum.
3. Click **Create** to execute the `CREATE SEQUENCE` statement.

The new sequence appears in the sidebar immediately after creation.

## Supported Databases

Sequences are a PostgreSQL-specific feature in Zequel:

- PostgreSQL
