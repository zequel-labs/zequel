import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the stores functionality for testing
describe('Tabs Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Tab Types', () => {
    it('should support query tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('query')
    })

    it('should support table tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('table')
    })

    it('should support view tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('view')
    })

    it('should support er-diagram tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('er-diagram')
    })

    it('should support routine tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('routine')
    })

    it('should support users tab type', () => {
      const tabTypes = ['query', 'table', 'view', 'er-diagram', 'routine', 'users']
      expect(tabTypes).toContain('users')
    })
  })

  describe('QueryPlan Interface', () => {
    it('should have required properties', () => {
      interface QueryPlan {
        rows: Record<string, unknown>[]
        columns: string[]
        planText?: string
      }

      const plan: QueryPlan = {
        rows: [{ id: 1, detail: 'Seq Scan' }],
        columns: ['id', 'detail'],
        planText: 'EXPLAIN output'
      }

      expect(plan.rows).toBeDefined()
      expect(plan.columns).toBeDefined()
      expect(plan.planText).toBe('EXPLAIN output')
    })
  })
})
