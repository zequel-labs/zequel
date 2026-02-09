import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'

describe('PostgreSQL Seed Data', () => {
  let client: pg.Client | null = null

  const config = {
    host: process.env.PG_HOST || '127.0.0.1',
    port: Number(process.env.PG_PORT) || 54320,
    user: process.env.PG_USERNAME || 'zequel',
    password: process.env.PG_PASSWORD || 'zequel',
    database: process.env.PG_DATABASE || 'zequel',
  }

  beforeAll(async () => {
    try {
      client = new pg.Client(config)
      await client.connect()
    } catch (error) {
      console.error('PostgreSQL connection failed:', (error as Error).message)
    }
  })

  afterAll(async () => {
    if (client) {
      await client.end()
    }
  })

  // -- Tables & Data ----------------------------------------------------------

  describe('tables and data', () => {
    it('should have customers table with 20 rows', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT COUNT(*) AS cnt FROM customers')
      expect(Number(result.rows[0].cnt)).toBe(20)
    })

    it('should have products table with 20 rows', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT COUNT(*) AS cnt FROM products')
      expect(Number(result.rows[0].cnt)).toBe(20)
    })

    it('should have orders table with 30 rows', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT COUNT(*) AS cnt FROM orders')
      expect(Number(result.rows[0].cnt)).toBe(30)
    })

    it('should have order_items table with 50 rows', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT COUNT(*) AS cnt FROM order_items')
      expect(Number(result.rows[0].cnt)).toBe(50)
    })
  })

  // -- Views ------------------------------------------------------------------

  describe('views', () => {
    const expectedViews = ['customer_order_summary', 'product_sales', 'recent_orders']

    it('should have all seed views', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT table_name FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name
      `)
      const viewNames = result.rows.map((r: { table_name: string }) => r.table_name)
      for (const v of expectedViews) {
        expect(viewNames).toContain(v)
      }
    })

    it('should return data from customer_order_summary', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT * FROM customer_order_summary LIMIT 5')
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('order_count')
      expect(result.rows[0]).toHaveProperty('total_spent')
    })

    it('should return data from product_sales', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT * FROM product_sales LIMIT 5')
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('units_sold')
      expect(result.rows[0]).toHaveProperty('revenue')
    })

    it('should return data from recent_orders', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT * FROM recent_orders LIMIT 5')
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('customer_name')
    })
  })

  // -- Functions --------------------------------------------------------------

  describe('functions', () => {
    it('should have get_customer_total_spent function', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
          AND routine_name = 'get_customer_total_spent'
      `)
      expect(result.rows.length).toBe(1)
    })

    it('should have format_price function', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
          AND routine_name = 'format_price'
      `)
      expect(result.rows.length).toBe(1)
    })

    it('should execute get_customer_total_spent', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT get_customer_total_spent(1) AS total')
      expect(Number(result.rows[0].total)).toBeGreaterThan(0)
    })

    it('should execute format_price', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT format_price(99.99) AS formatted")
      expect(result.rows[0].formatted).toContain('$')
      expect(result.rows[0].formatted).toContain('99.99')
    })
  })

  // -- Procedures -------------------------------------------------------------

  describe('procedures', () => {
    it('should have update_order_status procedure', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'
          AND routine_name = 'update_order_status'
      `)
      expect(result.rows.length).toBe(1)
    })
  })

  // -- Triggers ---------------------------------------------------------------

  describe('triggers', () => {
    it('should have trg_update_stock trigger', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT trigger_name FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name = 'trg_update_stock'
      `)
      expect(result.rows.length).toBe(1)
    })

    it('should have trg_order_status_change trigger', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT trigger_name FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name = 'trg_order_status_change'
      `)
      expect(result.rows.length).toBe(1)
    })
  })

  // -- Sequences --------------------------------------------------------------

  describe('sequences', () => {
    const expectedSequences = ['invoice_number_seq', 'ticket_number_seq', 'batch_id_seq']

    it('should have all seed sequences', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT sequencename FROM pg_sequences
        WHERE schemaname = 'public'
      `)
      const seqNames = result.rows.map((r: { sequencename: string }) => r.sequencename)
      for (const s of expectedSequences) {
        expect(seqNames).toContain(s)
      }
    })

    it('should be able to call nextval on invoice_number_seq', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT nextval('invoice_number_seq') AS val")
      expect(Number(result.rows[0].val)).toBeGreaterThanOrEqual(1000)
    })
  })

  // -- Materialized Views -----------------------------------------------------

  describe('materialized views', () => {
    const expectedMatViews = ['mv_monthly_sales', 'mv_category_stats']

    it('should have all seed materialized views', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT matviewname FROM pg_matviews
        WHERE schemaname = 'public'
      `)
      const mvNames = result.rows.map((r: { matviewname: string }) => r.matviewname)
      for (const mv of expectedMatViews) {
        expect(mvNames).toContain(mv)
      }
    })

    it('should return data from mv_monthly_sales', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT * FROM mv_monthly_sales LIMIT 5')
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('revenue')
    })

    it('should return data from mv_category_stats', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT * FROM mv_category_stats LIMIT 5')
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('total_revenue')
    })
  })

  // -- Extensions -------------------------------------------------------------

  describe('extensions', () => {
    const expectedExtensions = ['pg_trgm', 'uuid-ossp', 'hstore']

    it('should have all seed extensions', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query('SELECT extname FROM pg_extension')
      const extNames = result.rows.map((r: { extname: string }) => r.extname)
      for (const ext of expectedExtensions) {
        expect(extNames).toContain(ext)
      }
    })
  })

  // -- Users & Roles ----------------------------------------------------------

  describe('users and roles', () => {
    it('should have readonly_role', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'readonly_role'")
      expect(result.rows.length).toBe(1)
    })

    it('should have readwrite_role', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'readwrite_role'")
      expect(result.rows.length).toBe(1)
    })

    it('should have analyst user', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'analyst'")
      expect(result.rows.length).toBe(1)
    })

    it('should have developer user', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'developer'")
      expect(result.rows.length).toBe(1)
    })

    it('should have intern user', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query("SELECT rolname FROM pg_roles WHERE rolname = 'intern'")
      expect(result.rows.length).toBe(1)
    })

    it('analyst should have readonly_role membership', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query(`
        SELECT r.rolname AS member, g.rolname AS role
        FROM pg_auth_members m
        JOIN pg_roles r ON r.oid = m.member
        JOIN pg_roles g ON g.oid = m.roleid
        WHERE r.rolname = 'analyst' AND g.rolname = 'readonly_role'
      `)
      expect(result.rows.length).toBe(1)
    })
  })
})
