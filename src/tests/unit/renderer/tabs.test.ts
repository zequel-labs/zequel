import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { TabType } from '@/types/table'

describe('Tabs Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Tab Types', () => {
    it('should support query tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Query)
    })

    it('should support table tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Table)
    })

    it('should support view tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.View)
    })

    it('should support er-diagram tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.ERDiagram)
    })

    it('should support routine tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Routine)
    })

    it('should support users tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Users)
    })

    it('should support monitoring tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Monitoring)
    })

    it('should support trigger tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Trigger)
    })

    it('should support event tab type', () => {
      const tabTypes = Object.values(TabType)
      expect(tabTypes).toContain(TabType.Event)
    })

    it('should have all 17 tab types', () => {
      expect(Object.values(TabType)).toHaveLength(17)
    })
  })

})
