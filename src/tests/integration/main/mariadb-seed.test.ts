import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mysql from 'mysql2/promise'

describe('MariaDB Seed Data', () => {
  let connection: mysql.Connection | null = null

  const config = {
    host: process.env.MARIADB_HOST || '127.0.0.1',
    port: Number(process.env.MARIADB_PORT) || 33070,
    user: process.env.MARIADB_USERNAME || 'zequel',
    password: process.env.MARIADB_PASSWORD || 'zequel',
    database: process.env.MARIADB_DATABASE || 'zequel',
  }

  beforeAll(async () => {
    try {
      connection = await mysql.createConnection(config)
    } catch (error) {
      console.error('MariaDB connection failed:', (error as Error).message)
    }
  })

  afterAll(async () => {
    if (connection) {
      await connection.end()
    }
  })

  // -- Tables & Data ----------------------------------------------------------

  describe('tables and data', () => {
    it('should have customers table with 20 rows', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT COUNT(*) AS cnt FROM customers')
      expect(Number((rows as any[])[0].cnt)).toBe(20)
    })

    it('should have products table with 20 rows', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT COUNT(*) AS cnt FROM products')
      expect(Number((rows as any[])[0].cnt)).toBe(20)
    })

    it('should have orders table with 30 rows', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT COUNT(*) AS cnt FROM orders')
      expect(Number((rows as any[])[0].cnt)).toBe(30)
    })

    it('should have order_items table with 50 rows', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT COUNT(*) AS cnt FROM order_items')
      expect(Number((rows as any[])[0].cnt)).toBe(50)
    })
  })

  // -- Views ------------------------------------------------------------------

  describe('views', () => {
    const expectedViews = ['customer_order_summary', 'product_sales', 'recent_orders']

    it('should have all seed views', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT TABLE_NAME FROM information_schema.VIEWS
        WHERE TABLE_SCHEMA = ?
      `, [config.database])
      const viewNames = (rows as any[]).map((r: any) => r.TABLE_NAME)
      for (const v of expectedViews) {
        expect(viewNames).toContain(v)
      }
    })

    it('should return data from customer_order_summary', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT * FROM customer_order_summary LIMIT 5')
      expect((rows as any[]).length).toBeGreaterThan(0)
      expect((rows as any[])[0]).toHaveProperty('order_count')
      expect((rows as any[])[0]).toHaveProperty('total_spent')
    })

    it('should return data from product_sales', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT * FROM product_sales LIMIT 5')
      expect((rows as any[]).length).toBeGreaterThan(0)
      expect((rows as any[])[0]).toHaveProperty('units_sold')
    })
  })

  // -- Functions --------------------------------------------------------------

  describe('functions', () => {
    it('should have get_customer_total_spent function', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT ROUTINE_NAME FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'
          AND ROUTINE_NAME = 'get_customer_total_spent'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })

    it('should have format_price function', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT ROUTINE_NAME FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'
          AND ROUTINE_NAME = 'format_price'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })

    it('should execute get_customer_total_spent', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT get_customer_total_spent(1) AS total')
      expect(Number((rows as any[])[0].total)).toBeGreaterThan(0)
    })

    it('should execute format_price', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query('SELECT format_price(99.99) AS formatted')
      expect((rows as any[])[0].formatted).toContain('$')
    })
  })

  // -- Procedures -------------------------------------------------------------

  describe('procedures', () => {
    it('should have update_order_status procedure', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT ROUTINE_NAME FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'
          AND ROUTINE_NAME = 'update_order_status'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })
  })

  // -- Triggers ---------------------------------------------------------------

  describe('triggers', () => {
    it('should have trg_update_stock trigger', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_update_stock'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })

    it('should have trg_order_status_change trigger', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_order_status_change'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })
  })

  // -- Events -----------------------------------------------------------------

  describe('events', () => {
    it('should have evt_cleanup_cancelled_orders event', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT EVENT_NAME FROM information_schema.EVENTS
        WHERE EVENT_SCHEMA = ? AND EVENT_NAME = 'evt_cleanup_cancelled_orders'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
    })

    it('should have evt_daily_stats_log event (disabled)', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query(`
        SELECT EVENT_NAME, STATUS FROM information_schema.EVENTS
        WHERE EVENT_SCHEMA = ? AND EVENT_NAME = 'evt_daily_stats_log'
      `, [config.database])
      expect((rows as any[]).length).toBe(1)
      expect((rows as any[])[0].STATUS).toBe('DISABLED')
    })
  })

  // -- Users ------------------------------------------------------------------

  describe('users', () => {
    it('should have analyst user', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query("SELECT User FROM mysql.user WHERE User = 'analyst'")
      expect((rows as any[]).length).toBeGreaterThan(0)
    })

    it('should have developer user', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query("SELECT User FROM mysql.user WHERE User = 'developer'")
      expect((rows as any[]).length).toBeGreaterThan(0)
    })

    it('should have intern user', async () => {
      if (!connection) return console.warn('Skipping - no connection')
      const [rows] = await connection.query("SELECT User FROM mysql.user WHERE User = 'intern'")
      expect((rows as any[]).length).toBeGreaterThan(0)
    })
  })
})
