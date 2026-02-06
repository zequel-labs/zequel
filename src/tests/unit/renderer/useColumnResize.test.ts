import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useColumnResize } from '../../../renderer/composables/useColumnResize'

// Mock Vue's onUnmounted
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn()
  }
})

// Mock document for node environment
const listeners: Record<string, Function[]> = {}
const mockDocument = {
  addEventListener: vi.fn((event: string, handler: Function) => {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(handler)
  }),
  removeEventListener: vi.fn((event: string, handler: Function) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(h => h !== handler)
    }
  })
}

vi.stubGlobal('document', mockDocument)

// MouseEvent not available in node — create a simple mock
const createMouseEvent = (clientX: number): { clientX: number } => ({ clientX })

const fireEvent = (event: string, data: { clientX: number }): void => {
  const handlers = listeners[event] || []
  for (const handler of handlers) {
    handler(data)
  }
}

describe('useColumnResize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(listeners)) {
      delete listeners[key]
    }
  })

  it('should initialize with provided widths', () => {
    const initialWidths = { name: 200, type: 150 }
    const { columnWidths } = useColumnResize(initialWidths)

    expect(columnWidths.value).toEqual({ name: 200, type: 150 })
  })

  it('should not mutate the initial widths object', () => {
    const initialWidths = { name: 200, type: 150 }
    const { columnWidths } = useColumnResize(initialWidths)

    columnWidths.value.name = 300
    expect(initialWidths.name).toBe(200)
  })

  it('should start with no resizing column', () => {
    const { resizingColumn } = useColumnResize({ name: 200 })
    expect(resizingColumn.value).toBeNull()
  })

  it('should set resizingColumn on resize start', () => {
    const { resizingColumn, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    expect(resizingColumn.value).toBe('name')
  })

  it('should add mousemove and mouseup listeners on resize start', () => {
    const { onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    expect(mockDocument.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(mockDocument.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('should update column width on mouse move', () => {
    const { columnWidths, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    fireEvent('mousemove', createMouseEvent(150) as MouseEvent)

    expect(columnWidths.value.name).toBe(250) // 200 + (150 - 100)
  })

  it('should enforce minimum width (default 50)', () => {
    const { columnWidths, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    fireEvent('mousemove', createMouseEvent(-200) as MouseEvent)

    expect(columnWidths.value.name).toBe(50)
  })

  it('should use custom minimum width', () => {
    const { columnWidths, onResizeStart } = useColumnResize(
      { name: 200 },
      { minWidth: 100 }
    )

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    fireEvent('mousemove', createMouseEvent(-200) as MouseEvent)

    expect(columnWidths.value.name).toBe(100)
  })

  it('should clear resizingColumn and remove listeners on mouse up', () => {
    const { resizingColumn, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)
    expect(resizingColumn.value).toBe('name')

    fireEvent('mouseup', createMouseEvent(0) as MouseEvent)

    expect(resizingColumn.value).toBeNull()
    expect(mockDocument.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(mockDocument.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('should not update width after resize ends', () => {
    const { columnWidths, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)
    fireEvent('mouseup', createMouseEvent(0) as MouseEvent)

    // Listeners were removed so this has no effect
    expect(columnWidths.value.name).toBe(200)
  })

  it('should handle resizing with negative movement', () => {
    const { columnWidths, onResizeStart } = useColumnResize({ name: 200 })

    onResizeStart('name', createMouseEvent(100) as MouseEvent)

    fireEvent('mousemove', createMouseEvent(80) as MouseEvent)

    expect(columnWidths.value.name).toBe(180) // 200 + (80 - 100)
  })
})
