import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { SQLServerDriver } from '@main/db/sqlserver'
import {
  DatabaseType,
  TableObjectType,
  RoutineType,
  RoutineParameterMode,
  type ConnectionConfig
} from '@main/types'

describe('SQL Server Driver Integration', () => {
  let driver: SQLServerDriver | null = null
  let connectionError: string | null = null

  const config: ConnectionConfig = {
    id: 'test-sqlserver',
    name: 'Test SQL Server',
    type: DatabaseType.SQLServer,
    host: process.env.SQLSERVER_HOST || '127.0.0.1',
    port: Number(process.env.SQLSERVER_PORT) || 14330,
    username: process.env.SQLSERVER_USERNAME || 'sa',
    password: process.env.SQLSERVER_PASSWORD || 'Zequel123!',
    database: process.env.SQLSERVER_DATABASE || 'zequel',
    ssl: false,
    trustServerCertificate: true,
  }

  beforeAll(async () => {
    try {
      driver = new SQLServerDriver()
      await driver.connect(config)
    } catch (error) {
      connectionError = (error as Error).message
      console.warn(`[SQL Server Integration] Skipping tests — container not available: ${connectionError}`)
      driver = null
    }
  })

  afterAll(async () => {
    if (driver) {
      await driver.disconnect()
    }
  })

  // -- Connection ---------------------------------------------------------------

  it('should connect to SQL Server database', () => {
    if (!driver) return
    expect(driver.isConnected).toBe(true)
  })

  // -- getDatabases() -----------------------------------------------------------

  describe('getDatabases', () => {
    it('should include zequel database', async () => {
      if (!driver) return
      const databases = await driver.getDatabases()
      const dbNames = databases.map((d) => d.name)
      expect(dbNames).toContain('zequel')
    })
  })

  // -- getSchemas() -------------------------------------------------------------

  describe('getSchemas', () => {
    it('should include dbo schema', async () => {
      if (!driver) return
      const schemas = await driver.getSchemas()
      const schemaNames = schemas.map((s) => s.name)
      expect(schemaNames).toContain('dbo')
    })

    it('should include reporting schema', async () => {
      if (!driver) return
      const schemas = await driver.getSchemas()
      const schemaNames = schemas.map((s) => s.name)
      expect(schemaNames).toContain('reporting')
    })

    it('should return dbo first (sorted)', async () => {
      if (!driver) return
      const schemas = await driver.getSchemas()
      expect(schemas[0].name).toBe('dbo')
    })

    it('should include tableCount for schemas', async () => {
      if (!driver) return
      const schemas = await driver.getSchemas()
      const dbo = schemas.find((s) => s.name === 'dbo')
      expect(dbo).toBeDefined()
      expect(dbo!.tableCount).toBeGreaterThanOrEqual(4)
    })
  })

  // -- getTables() --------------------------------------------------------------

  describe('getTables', () => {
    it('should find all seeded tables in dbo schema', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const tables = await driver.getTables('zequel')
      const tableNames = tables.map((t) => t.name)
      expect(tableNames).toContain('customers')
      expect(tableNames).toContain('products')
      expect(tableNames).toContain('orders')
      expect(tableNames).toContain('order_items')
    })

    it('should find all seeded views in dbo schema', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const tables = await driver.getTables('zequel')
      const views = tables.filter((t) => t.type === TableObjectType.View)
      const viewNames = views.map((v) => v.name)
      expect(viewNames).toContain('customer_order_summary')
      expect(viewNames).toContain('product_sales')
      expect(viewNames).toContain('recent_orders')
    })

    it('should distinguish tables from views', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const tables = await driver.getTables('zequel')
      const customersEntry = tables.find((t) => t.name === 'customers')
      const summaryEntry = tables.find((t) => t.name === 'customer_order_summary')
      expect(customersEntry?.type).toBe(TableObjectType.Table)
      expect(summaryEntry?.type).toBe(TableObjectType.View)
    })

    it('should find reporting.monthly_summary table', async () => {
      if (!driver) return
      driver.setCurrentSchema('reporting')
      const tables = await driver.getTables('zequel', 'reporting')
      const tableNames = tables.map((t) => t.name)
      expect(tableNames).toContain('monthly_summary')
    })

    it('should find reporting.revenue_by_month view', async () => {
      if (!driver) return
      driver.setCurrentSchema('reporting')
      const tables = await driver.getTables('zequel', 'reporting')
      const views = tables.filter((t) => t.type === TableObjectType.View)
      const viewNames = views.map((v) => v.name)
      expect(viewNames).toContain('revenue_by_month')
    })
  })

  // -- getColumns() -------------------------------------------------------------

  describe('getColumns', () => {
    it('should return columns for customers table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const columnNames = columns.map((c) => c.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('name')
      expect(columnNames).toContain('email')
      expect(columnNames).toContain('phone')
      expect(columnNames).toContain('city')
      expect(columnNames).toContain('country')
      expect(columnNames).toContain('created_at')
    })

    it('should detect primary key on customers.id', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const idCol = columns.find((c) => c.name === 'id')
      expect(idCol).toBeDefined()
      expect(idCol!.primaryKey).toBe(true)
    })

    it('should detect identity (auto increment) on customers.id', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const idCol = columns.find((c) => c.name === 'id')
      expect(idCol).toBeDefined()
      expect(idCol!.autoIncrement).toBe(true)
    })

    it('should detect NOT NULL on customers.name', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const nameCol = columns.find((c) => c.name === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol!.nullable).toBe(false)
    })

    it('should detect nullable on customers.phone', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const phoneCol = columns.find((c) => c.name === 'phone')
      expect(phoneCol).toBeDefined()
      expect(phoneCol!.nullable).toBe(true)
    })

    it('should report correct type for customers.name as nvarchar(100)', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const nameCol = columns.find((c) => c.name === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol!.type.toLowerCase()).toBe('nvarchar(100)')
    })

    it('should report correct type for products.price as decimal(10,2)', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('products')
      const priceCol = columns.find((c) => c.name === 'price')
      expect(priceCol).toBeDefined()
      expect(priceCol!.type.toLowerCase()).toBe('decimal(10,2)')
    })

    it('should detect unique constraint on customers.email', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const columns = await driver.getColumns('customers')
      const emailCol = columns.find((c) => c.name === 'email')
      expect(emailCol).toBeDefined()
      expect(emailCol!.unique).toBe(true)
    })
  })

  // -- getIndexes() -------------------------------------------------------------

  describe('getIndexes', () => {
    it('should have primary key index on customers table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const indexes = await driver.getIndexes('customers')
      const pkIndex = indexes.find((i) => i.primary)
      expect(pkIndex).toBeDefined()
      expect(pkIndex!.columns).toContain('id')
      expect(pkIndex!.unique).toBe(true)
    })

    it('should have primary key index on products table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const indexes = await driver.getIndexes('products')
      const pkIndex = indexes.find((i) => i.primary)
      expect(pkIndex).toBeDefined()
      expect(pkIndex!.columns).toContain('id')
    })

    it('should have primary key index on orders table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const indexes = await driver.getIndexes('orders')
      const pkIndex = indexes.find((i) => i.primary)
      expect(pkIndex).toBeDefined()
      expect(pkIndex!.columns).toContain('id')
    })

    it('should have primary key index on order_items table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const indexes = await driver.getIndexes('order_items')
      const pkIndex = indexes.find((i) => i.primary)
      expect(pkIndex).toBeDefined()
      expect(pkIndex!.columns).toContain('id')
    })

    it('should have unique index on customers.email', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const indexes = await driver.getIndexes('customers')
      const uniqueIndex = indexes.find((i) => i.unique && !i.primary && i.columns.includes('email'))
      expect(uniqueIndex).toBeDefined()
    })
  })

  // -- getForeignKeys() ---------------------------------------------------------

  describe('getForeignKeys', () => {
    it('should have foreign key on orders.customer_id referencing customers', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const fks = await driver.getForeignKeys('orders')
      const customerFk = fks.find((fk) => fk.column === 'customer_id')
      expect(customerFk).toBeDefined()
      expect(customerFk!.referencedTable).toBe('customers')
      expect(customerFk!.referencedColumn).toBe('id')
    })

    it('should have foreign key on order_items.order_id referencing orders', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const fks = await driver.getForeignKeys('order_items')
      const orderFk = fks.find((fk) => fk.column === 'order_id')
      expect(orderFk).toBeDefined()
      expect(orderFk!.referencedTable).toBe('orders')
      expect(orderFk!.referencedColumn).toBe('id')
    })

    it('should have foreign key on order_items.product_id referencing products', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const fks = await driver.getForeignKeys('order_items')
      const productFk = fks.find((fk) => fk.column === 'product_id')
      expect(productFk).toBeDefined()
      expect(productFk!.referencedTable).toBe('products')
      expect(productFk!.referencedColumn).toBe('id')
    })

    it('should not have foreign keys on customers table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const fks = await driver.getForeignKeys('customers')
      expect(fks.length).toBe(0)
    })
  })

  // -- getTableData() -----------------------------------------------------------

  describe('getTableData', () => {
    it('should return 20 rows for customers table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('customers', { limit: 100 })
      expect(result.totalCount).toBe(20)
      expect(result.rows.length).toBe(20)
    })

    it('should return 20 rows for products table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('products', { limit: 100 })
      expect(result.totalCount).toBe(20)
      expect(result.rows.length).toBe(20)
    })

    it('should return 30 rows for orders table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('orders', { limit: 100 })
      expect(result.totalCount).toBe(30)
      expect(result.rows.length).toBe(30)
    })

    it('should return 50 rows for order_items table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('order_items', { limit: 100 })
      expect(result.totalCount).toBe(50)
      expect(result.rows.length).toBe(50)
    })

    it('should respect limit option', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('customers', { limit: 5 })
      expect(result.rows.length).toBe(5)
      expect(result.totalCount).toBe(20)
    })

    it('should respect offset option', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('customers', { limit: 5, offset: 15 })
      expect(result.rows.length).toBe(5)
      expect(result.offset).toBe(15)
    })

    it('should return column info for table data', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.getTableData('customers', { limit: 1 })
      expect(result.columns.length).toBeGreaterThan(0)
      const colNames = result.columns.map((c) => c.name)
      expect(colNames).toContain('id')
      expect(colNames).toContain('name')
      expect(colNames).toContain('email')
    })

    it('should return 3 rows for reporting.monthly_summary', async () => {
      if (!driver) return
      driver.setCurrentSchema('reporting')
      const result = await driver.getTableData('monthly_summary', { limit: 100 })
      expect(result.totalCount).toBe(3)
      expect(result.rows.length).toBe(3)
    })
  })

  // -- execute() ----------------------------------------------------------------

  describe('execute', () => {
    it('should execute a simple SELECT 1 query', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT 1 AS test')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBe(1)
      expect(result.rows[0].test).toBe(1)
    })

    it('should execute a SELECT query against seed data', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT name, email FROM dbo.customers WHERE id = 1')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBe(1)
      expect(result.rows[0].name).toBe('Alice Johnson')
      expect(result.rows[0].email).toBe('alice@example.com')
    })

    it('should execute a SELECT COUNT query', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT COUNT(*) AS cnt FROM dbo.customers')
      expect(result.error).toBeUndefined()
      expect(result.rows[0].cnt).toBe(20)
    })

    it('should execute a query with parameters', async () => {
      if (!driver) return
      const result = await driver.execute(
        'SELECT name FROM dbo.customers WHERE country = ?',
        ['USA']
      )
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBe(2)
    })

    it('should return column metadata from query results', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT id, name, email FROM dbo.customers WHERE id = 1')
      expect(result.columns.length).toBe(3)
      const colNames = result.columns.map((c) => c.name)
      expect(colNames).toContain('id')
      expect(colNames).toContain('name')
      expect(colNames).toContain('email')
    })

    it('should return error for invalid query without throwing', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT * FROM non_existent_table_xyz')
      expect(result.error).toBeDefined()
      expect(result.rows.length).toBe(0)
    })

    it('should include execution time', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT 1 AS test')
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  // -- getRoutines() ------------------------------------------------------------

  describe('getRoutines', () => {
    it('should find all routines (functions and procedures)', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const routines = await driver.getRoutines()
      const routineNames = routines.map((r) => r.name)
      expect(routineNames).toContain('get_customer_total_spent')
      expect(routineNames).toContain('format_price')
      expect(routineNames).toContain('update_order_status')
    })

    it('should filter functions only', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const functions = await driver.getRoutines(RoutineType.Function)
      const funcNames = functions.map((r) => r.name)
      expect(funcNames).toContain('get_customer_total_spent')
      expect(funcNames).toContain('format_price')
      expect(funcNames).not.toContain('update_order_status')
      for (const fn of functions) {
        expect(fn.type).toBe(RoutineType.Function)
      }
    })

    it('should filter procedures only', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const procedures = await driver.getRoutines(RoutineType.Procedure)
      const procNames = procedures.map((r) => r.name)
      expect(procNames).toContain('update_order_status')
      expect(procNames).not.toContain('get_customer_total_spent')
      for (const proc of procedures) {
        expect(proc.type).toBe(RoutineType.Procedure)
      }
    })

    it('should include parameters for get_customer_total_spent', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const routines = await driver.getRoutines(RoutineType.Function)
      const fn = routines.find((r) => r.name === 'get_customer_total_spent')
      expect(fn).toBeDefined()
      expect(fn!.parameters).toBeDefined()
      expect(fn!.parameters!.length).toBeGreaterThanOrEqual(1)
      const param = fn!.parameters!.find((p) => p.name === 'customer_id')
      expect(param).toBeDefined()
      expect(param!.type).toBe('int')
      expect(param!.mode).toBe(RoutineParameterMode.In)
    })

    it('should include parameters for update_order_status procedure', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const routines = await driver.getRoutines(RoutineType.Procedure)
      const proc = routines.find((r) => r.name === 'update_order_status')
      expect(proc).toBeDefined()
      expect(proc!.parameters).toBeDefined()
      expect(proc!.parameters!.length).toBe(2)
      const paramNames = proc!.parameters!.map((p) => p.name)
      expect(paramNames).toContain('order_id')
      expect(paramNames).toContain('status')
    })

    it('should include schema information for routines', async () => {
      if (!driver) return
      const routines = await driver.getRoutines()
      const fn = routines.find((r) => r.name === 'get_customer_total_spent')
      expect(fn).toBeDefined()
      expect(fn!.schema).toBe('dbo')
    })
  })

  // -- getTriggers() ------------------------------------------------------------

  describe('getTriggers', () => {
    it('should find all seeded triggers', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const triggers = await driver.getTriggers()
      const triggerNames = triggers.map((t) => t.name)
      expect(triggerNames).toContain('trg_update_stock')
      expect(triggerNames).toContain('trg_order_status_change')
    })

    it('should return trg_update_stock on order_items table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const triggers = await driver.getTriggers()
      const stockTrigger = triggers.find((t) => t.name === 'trg_update_stock')
      expect(stockTrigger).toBeDefined()
      expect(stockTrigger!.table).toBe('order_items')
      expect(stockTrigger!.timing).toBe('AFTER')
      expect(stockTrigger!.event).toContain('INSERT')
    })

    it('should return trg_order_status_change on orders table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const triggers = await driver.getTriggers()
      const statusTrigger = triggers.find((t) => t.name === 'trg_order_status_change')
      expect(statusTrigger).toBeDefined()
      expect(statusTrigger!.table).toBe('orders')
      expect(statusTrigger!.timing).toBe('AFTER')
      expect(statusTrigger!.event).toContain('UPDATE')
    })

    it('should filter triggers by table name', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const triggers = await driver.getTriggers('order_items')
      expect(triggers.length).toBeGreaterThanOrEqual(1)
      const triggerNames = triggers.map((t) => t.name)
      expect(triggerNames).toContain('trg_update_stock')
      expect(triggerNames).not.toContain('trg_order_status_change')
    })

    it('should report triggers as enabled', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const triggers = await driver.getTriggers()
      for (const trigger of triggers) {
        expect(trigger.enabled).toBe(true)
      }
    })
  })

  // -- View data ----------------------------------------------------------------

  describe('view data', () => {
    it('should return data from customer_order_summary view', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.execute('SELECT TOP 5 * FROM dbo.customer_order_summary')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('order_count')
      expect(result.rows[0]).toHaveProperty('total_spent')
    })

    it('should return data from product_sales view', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.execute('SELECT TOP 5 * FROM dbo.product_sales')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('units_sold')
      expect(result.rows[0]).toHaveProperty('revenue')
    })

    it('should return data from recent_orders view', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const result = await driver.execute('SELECT TOP 5 * FROM dbo.recent_orders')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('customer_name')
    })

    it('should return data from reporting.revenue_by_month view', async () => {
      if (!driver) return
      const result = await driver.execute('SELECT * FROM reporting.revenue_by_month')
      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBe(3)
      expect(result.rows[0]).toHaveProperty('revenue')
      expect(result.rows[0]).toHaveProperty('avg_order_value')
    })
  })

  // -- getTableDDL() ------------------------------------------------------------

  describe('getTableDDL', () => {
    it('should return DDL for customers table', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const ddl = await driver.getTableDDL('customers')
      expect(ddl).toContain('CREATE TABLE')
      expect(ddl).toContain('customers')
      expect(ddl).toContain('id')
      expect(ddl).toContain('name')
      expect(ddl).toContain('email')
    })
  })

  // -- getViewDDL() -------------------------------------------------------------

  describe('getViewDDL', () => {
    it('should return definition for customer_order_summary view', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')
      const ddl = await driver.getViewDDL('customer_order_summary')
      expect(ddl).toContain('customer_order_summary')
    })
  })

  // -- ping() -------------------------------------------------------------------

  describe('ping', () => {
    it('should ping successfully when connected', async () => {
      if (!driver) return
      const result = await driver.ping()
      expect(result).toBe(true)
    })
  })

  // -- Transactions -------------------------------------------------------------

  describe('transactions', () => {
    it('should begin and rollback a transaction', async () => {
      if (!driver) return
      driver.setCurrentSchema('dbo')

      await driver.beginTransaction()
      expect(driver.inTransaction).toBe(true)

      await driver.execute(
        "INSERT INTO dbo.customers (name, email, city, country) VALUES ('Tx Test', 'txtest@example.com', 'TestCity', 'TestCountry')",
        [],
        true
      )

      await driver.rollbackTransaction()
      expect(driver.inTransaction).toBe(false)

      // Verify the insert was rolled back
      const result = await driver.execute(
        "SELECT COUNT(*) AS cnt FROM dbo.customers WHERE email = 'txtest@example.com'"
      )
      expect(result.rows[0].cnt).toBe(0)
    })
  })
})
