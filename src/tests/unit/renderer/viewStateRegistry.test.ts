import { describe, it, expect, beforeEach } from 'vitest'
import { viewStateRegistry } from '@/stores/viewStateRegistry'
import type { TableViewState, QueryViewState } from '@/types/viewState'

describe('viewStateRegistry', () => {
  beforeEach(() => {
    viewStateRegistry._collectors.clear()
  })

  describe('register / unregister', () => {
    it('should register a collector', () => {
      const collector = () => ({ runMode: 'current' as const })
      viewStateRegistry.register('tab-1', collector)

      expect(viewStateRegistry._collectors.has('tab-1')).toBe(true)
    })

    it('should unregister a collector', () => {
      viewStateRegistry.register('tab-1', () => null)
      viewStateRegistry.unregister('tab-1')

      expect(viewStateRegistry._collectors.has('tab-1')).toBe(false)
    })

    it('should replace an existing collector on re-register', () => {
      viewStateRegistry.register('tab-1', () => ({ runMode: 'current' as const }))
      viewStateRegistry.register('tab-1', () => ({ runMode: 'all' as const }))

      const result = viewStateRegistry.collectForSession(['tab-1'])
      const state = result.get('tab-1') as QueryViewState
      expect(state.runMode).toBe('all')
    })
  })

  describe('collectForSession', () => {
    it('should collect state for requested tab IDs', () => {
      const tableState: TableViewState = {
        dataResult: null,
        offset: 50,
        filters: [],
        error: null
      }
      const queryState: QueryViewState = { runMode: 'all' }

      viewStateRegistry.register('tab-1', () => tableState)
      viewStateRegistry.register('tab-2', () => queryState)

      const result = viewStateRegistry.collectForSession(['tab-1', 'tab-2'])

      expect(result.size).toBe(2)
      expect(result.get('tab-1')).toEqual(tableState)
      expect(result.get('tab-2')).toEqual(queryState)
    })

    it('should skip tab IDs without registered collectors', () => {
      viewStateRegistry.register('tab-1', () => ({ runMode: 'current' as const }))

      const result = viewStateRegistry.collectForSession(['tab-1', 'tab-999'])

      expect(result.size).toBe(1)
      expect(result.has('tab-999')).toBe(false)
    })

    it('should skip collectors that return null', () => {
      viewStateRegistry.register('tab-1', () => null)

      const result = viewStateRegistry.collectForSession(['tab-1'])

      expect(result.size).toBe(0)
    })

    it('should return empty map for empty tab IDs', () => {
      viewStateRegistry.register('tab-1', () => ({ runMode: 'current' as const }))

      const result = viewStateRegistry.collectForSession([])

      expect(result.size).toBe(0)
    })

    it('should not include collectors for tab IDs not in the request', () => {
      viewStateRegistry.register('tab-1', () => ({ runMode: 'current' as const }))
      viewStateRegistry.register('tab-2', () => ({ runMode: 'all' as const }))

      const result = viewStateRegistry.collectForSession(['tab-1'])

      expect(result.size).toBe(1)
      expect(result.has('tab-2')).toBe(false)
    })

    it('should skip collectors that throw and continue collecting others', () => {
      viewStateRegistry.register('tab-ok', () => ({ runMode: 'current' as const }))
      viewStateRegistry.register('tab-throw', () => { throw new Error('unmounted') })
      viewStateRegistry.register('tab-ok2', () => ({ runMode: 'all' as const }))

      const result = viewStateRegistry.collectForSession(['tab-ok', 'tab-throw', 'tab-ok2'])

      expect(result.size).toBe(2)
      expect(result.has('tab-ok')).toBe(true)
      expect(result.has('tab-throw')).toBe(false)
      expect(result.has('tab-ok2')).toBe(true)
    })

    it('should handle all collectors throwing without crashing', () => {
      viewStateRegistry.register('tab-1', () => { throw new Error('fail 1') })
      viewStateRegistry.register('tab-2', () => { throw new Error('fail 2') })

      const result = viewStateRegistry.collectForSession(['tab-1', 'tab-2'])

      expect(result.size).toBe(0)
    })
  })
})
