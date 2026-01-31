import { isDateValue, formatDateTime } from './date'

export const formatCellValue = (value: unknown): string => {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (isDateValue(value)) return formatDateTime(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
