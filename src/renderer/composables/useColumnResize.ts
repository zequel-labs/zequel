import { ref, onUnmounted } from 'vue'

interface UseColumnResizeOptions {
  minWidth?: number
}

export const useColumnResize = (
  initialWidths: Record<string, number>,
  options: UseColumnResizeOptions = {}
) => {
  const minWidth = options.minWidth ?? 50

  const columnWidths = ref<Record<string, number>>({ ...initialWidths })
  const resizingColumn = ref<string | null>(null)

  let startX = 0
  let startWidth = 0

  const onResizeMove = (event: MouseEvent): void => {
    if (!resizingColumn.value) return
    const diff = event.clientX - startX
    const newWidth = Math.max(minWidth, startWidth + diff)
    columnWidths.value[resizingColumn.value] = newWidth
  }

  const onResizeEnd = (): void => {
    resizingColumn.value = null
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  }

  const onResizeStart = (columnKey: string, event: MouseEvent): void => {
    resizingColumn.value = columnKey
    startX = event.clientX
    startWidth = columnWidths.value[columnKey]
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  })

  return { columnWidths, resizingColumn, onResizeStart }
}
