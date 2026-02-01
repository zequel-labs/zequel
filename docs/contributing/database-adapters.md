# Database Adapters

Every supported database engine has its own adapter in `src/main/db/`. All adapters implement a shared interface so the rest of the application can work with any database uniformly.

## Architecture

```
src/main/db/
  base.ts          DatabaseDriver interface and BaseDriver abstract class
  manager.ts       Connection manager (maps connection IDs to driver instances)
  postgres.ts      PostgreSQL adapter
  mysql.ts         MySQL adapter
  mariadb.ts       MariaDB adapter
  sqlite.ts        SQLite adapter
  clickhouse.ts    ClickHouse adapter
  mongodb.ts       MongoDB adapter
  redis.ts         Redis adapter
```

## The DatabaseDriver Interface

Defined in `src/main/db/base.ts`, the `DatabaseDriver` interface is the contract every adapter must satisfy:

```typescript
export interface DatabaseDriver {
  readonly type: DatabaseType;
  readonly isConnected: boolean;

  // Lifecycle
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(config: ConnectionConfig): Promise<TestConnectionResult>;
  ping(): Promise<boolean>;

  // Query execution
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  cancelQuery(): Promise<boolean>;

  // Schema introspection
  getDatabases(): Promise<Database[]>;
  getTables(database: string, schema?: string): Promise<Table[]>;
  getColumns(table: string): Promise<Column[]>;
  getIndexes(table: string): Promise<Index[]>;
  getForeignKeys(table: string): Promise<ForeignKey[]>;
  getTableDDL(table: string): Promise<string>;
  getTableData(table: string, options: DataOptions): Promise<DataResult>;
  getDataTypes(): DataTypeInfo[];
  getPrimaryKeyColumns(table: string): Promise<string[]>;

  // Schema editing -- columns
  addColumn(request: AddColumnRequest): Promise<SchemaOperationResult>;
  modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult>;
  dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult>;
  renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult>;

  // Schema editing -- indexes
  createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult>;
  dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult>;

  // Schema editing -- foreign keys
  addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult>;
  dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult>;

  // Schema editing -- tables
  createTable(request: CreateTableRequest): Promise<SchemaOperationResult>;
  dropTable(request: DropTableRequest): Promise<SchemaOperationResult>;
  renameTable(request: RenameTableRequest): Promise<SchemaOperationResult>;

  // Row operations
  insertRow(request: InsertRowRequest): Promise<SchemaOperationResult>;
  deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult>;

  // Views
  createView(request: CreateViewRequest): Promise<SchemaOperationResult>;
  dropView(request: DropViewRequest): Promise<SchemaOperationResult>;
  renameView(request: RenameViewRequest): Promise<SchemaOperationResult>;
  getViewDDL(viewName: string): Promise<string>;

  // Routines (stored procedures and functions)
  getRoutines(type?: RoutineType): Promise<Routine[]>;
  getRoutineDefinition(name: string, type: RoutineType): Promise<string>;

  // User management
  getUsers(): Promise<DatabaseUser[]>;
  getUserPrivileges(username: string, host?: string): Promise<UserPrivilege[]>;

  // Triggers
  getTriggers(table?: string): Promise<Trigger[]>;
  getTriggerDefinition(name: string, table?: string): Promise<string>;
  createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult>;
  dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult>;
}
```

## The BaseDriver Abstract Class

`BaseDriver` provides a default implementation for several methods so that concrete adapters only need to override engine-specific behavior:

- **`testConnection`** -- connects, measures latency, disconnects.
- **`ping`** -- returns `false` by default; override for engines that support a lightweight ping.
- **`cancelQuery`** -- returns `false` by default; override where cancellation is supported.
- **`buildWhereClause`**, **`buildOrderClause`**, **`buildLimitClause`** -- helper methods for constructing SQL from `DataOptions`.

Every concrete adapter extends `BaseDriver` and implements all abstract methods.

## The Connection Manager

`manager.ts` maintains a map of connection IDs to active `DatabaseDriver` instances. When the renderer requests an operation (for example, via `schema:tables`), the IPC handler looks up the driver for that connection ID in the manager and delegates the call.

## Adding a New Adapter

1. **Create the adapter file** at `src/main/db/<engine>.ts`.
2. **Extend `BaseDriver`** and implement every abstract method:
   ```typescript
   import { BaseDriver } from './base';
   import { DatabaseType } from '../types';

   export class MyEngineDriver extends BaseDriver {
     readonly type = DatabaseType.MyEngine;

     async connect(config: ConnectionConfig): Promise<void> {
       // establish the connection
       this._isConnected = true;
     }

     async disconnect(): Promise<void> {
       // close the connection
       this._isConnected = false;
     }

     async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
       this.ensureConnected();
       // run the query and return results
     }

     // ... implement all remaining abstract methods
   }
   ```
3. **Register the adapter** in `manager.ts` so the manager can instantiate it for the new `DatabaseType`.
4. **Add the `DatabaseType` enum member** in `src/main/types/` if it does not already exist.
5. **Add Docker setup** in `docker/` with an init script and seed data, and update `docker-compose.yml`.
6. **Write tests** -- unit tests in `src/tests/unit/main/db/` and integration tests in `src/tests/integration/`.
