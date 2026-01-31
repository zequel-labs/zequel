import { describe, it, expect } from 'vitest'
import {
  TabType,
  TableObjectType,
  RoutineType,
  RoutineParameterMode,
  EventStatus,
  SortDirection,
  ItemType,
} from '../../../renderer/types/table'

describe('Renderer Enums', () => {
  describe('TabType', () => {
    it('should have 13 members', () => {
      expect(Object.keys(TabType)).toHaveLength(13)
    })

    it('should have correct string values for serialization', () => {
      expect(TabType.Query).toBe('query')
      expect(TabType.Table).toBe('table')
      expect(TabType.View).toBe('view')
      expect(TabType.ERDiagram).toBe('er-diagram')
      expect(TabType.Routine).toBe('routine')
      expect(TabType.Users).toBe('users')
      expect(TabType.Monitoring).toBe('monitoring')
      expect(TabType.Trigger).toBe('trigger')
      expect(TabType.Event).toBe('event')
      expect(TabType.Sequence).toBe('sequence')
      expect(TabType.MaterializedView).toBe('materialized-view')
      expect(TabType.Extensions).toBe('extensions')
      expect(TabType.Enums).toBe('enums')
    })
  })

  describe('TableObjectType', () => {
    it('should have 2 members', () => {
      expect(Object.keys(TableObjectType)).toHaveLength(2)
    })

    it('should have correct string values', () => {
      expect(TableObjectType.Table).toBe('table')
      expect(TableObjectType.View).toBe('view')
    })
  })

  describe('RoutineType', () => {
    it('should have 2 members', () => {
      expect(Object.keys(RoutineType)).toHaveLength(2)
    })

    it('should have correct string values', () => {
      expect(RoutineType.Procedure).toBe('PROCEDURE')
      expect(RoutineType.Function).toBe('FUNCTION')
    })
  })

  describe('RoutineParameterMode', () => {
    it('should have 3 members', () => {
      expect(Object.keys(RoutineParameterMode)).toHaveLength(3)
    })

    it('should have correct string values', () => {
      expect(RoutineParameterMode.In).toBe('IN')
      expect(RoutineParameterMode.Out).toBe('OUT')
      expect(RoutineParameterMode.InOut).toBe('INOUT')
    })
  })

  describe('EventStatus', () => {
    it('should have 3 members', () => {
      expect(Object.keys(EventStatus)).toHaveLength(3)
    })

    it('should have correct string values', () => {
      expect(EventStatus.Enabled).toBe('ENABLED')
      expect(EventStatus.Disabled).toBe('DISABLED')
      expect(EventStatus.SlavesideDisabled).toBe('SLAVESIDE_DISABLED')
    })
  })

  describe('SortDirection', () => {
    it('should have 2 members', () => {
      expect(Object.keys(SortDirection)).toHaveLength(2)
    })

    it('should have correct string values', () => {
      expect(SortDirection.Asc).toBe('ASC')
      expect(SortDirection.Desc).toBe('DESC')
    })
  })

  describe('ItemType', () => {
    it('should have 3 members', () => {
      expect(Object.keys(ItemType)).toHaveLength(3)
    })

    it('should have correct string values', () => {
      expect(ItemType.Table).toBe('table')
      expect(ItemType.View).toBe('view')
      expect(ItemType.Query).toBe('query')
    })
  })

  describe('Enum value uniqueness', () => {
    it('TabType values should all be unique', () => {
      const values = Object.values(TabType)
      expect(new Set(values).size).toBe(values.length)
    })

    it('TableObjectType values should all be unique', () => {
      const values = Object.values(TableObjectType)
      expect(new Set(values).size).toBe(values.length)
    })

    it('ItemType values should all be unique', () => {
      const values = Object.values(ItemType)
      expect(new Set(values).size).toBe(values.length)
    })
  })
})
