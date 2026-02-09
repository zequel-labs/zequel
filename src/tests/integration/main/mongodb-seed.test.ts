import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoClient, type Db } from 'mongodb'

describe('MongoDB Seed Data', () => {
  let client: MongoClient | null = null
  let db: Db | null = null

  const uri = process.env.MONGO_URI || 'mongodb://zequel:zequel@127.0.0.1:27018/zequel?authSource=admin'

  beforeAll(async () => {
    try {
      client = new MongoClient(uri)
      await client.connect()
      db = client.db('zequel')
    } catch (error) {
      console.error('MongoDB connection failed:', (error as Error).message)
    }
  })

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  // -- Collections & Data -----------------------------------------------------

  describe('collections and data', () => {
    it('should have customers collection with 20 documents', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const count = await db.collection('customers').countDocuments()
      expect(count).toBe(20)
    })

    it('should have products collection with 20 documents', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const count = await db.collection('products').countDocuments()
      expect(count).toBe(20)
    })

    it('should have orders collection with 30 documents', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const count = await db.collection('orders').countDocuments()
      expect(count).toBe(30)
    })
  })

  // -- Views ------------------------------------------------------------------

  describe('views', () => {
    it('should have customer_order_summary view', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const collections = await db.listCollections({ name: 'customer_order_summary', type: 'view' }).toArray()
      expect(collections.length).toBe(1)
    })

    it('should have product_catalog view', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const collections = await db.listCollections({ name: 'product_catalog', type: 'view' }).toArray()
      expect(collections.length).toBe(1)
    })

    it('should have recent_orders view', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const collections = await db.listCollections({ name: 'recent_orders', type: 'view' }).toArray()
      expect(collections.length).toBe(1)
    })

    it('should return data from customer_order_summary', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const docs = await db.collection('customer_order_summary').find().limit(5).toArray()
      expect(docs.length).toBeGreaterThan(0)
      expect(docs[0]).toHaveProperty('order_count')
      expect(docs[0]).toHaveProperty('total_spent')
    })

    it('should return data from product_catalog', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const docs = await db.collection('product_catalog').find().limit(5).toArray()
      expect(docs.length).toBeGreaterThan(0)
      expect(docs[0]).toHaveProperty('in_stock')
    })

    it('should return data from recent_orders', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const docs = await db.collection('recent_orders').find().limit(5).toArray()
      expect(docs.length).toBeGreaterThan(0)
      expect(docs[0]).toHaveProperty('item_count')
    })
  })

  // -- Indexes ----------------------------------------------------------------

  describe('indexes', () => {
    it('should have unique index on customers.email', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const indexes = await db.collection('customers').indexes()
      const emailIndex = indexes.find((i) => i.key && (i.key as Record<string, number>).email === 1)
      expect(emailIndex).toBeDefined()
      expect(emailIndex!.unique).toBe(true)
    })

    it('should have index on orders.customer_id', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const indexes = await db.collection('orders').indexes()
      const idx = indexes.find((i) => i.key && (i.key as Record<string, number>).customer_id === 1)
      expect(idx).toBeDefined()
    })

    it('should have index on orders.status', async () => {
      if (!db) return console.warn('Skipping - no connection')
      const indexes = await db.collection('orders').indexes()
      const idx = indexes.find((i) => i.key && (i.key as Record<string, number>).status === 1)
      expect(idx).toBeDefined()
    })
  })
})
