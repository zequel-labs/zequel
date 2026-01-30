import dayjs from 'dayjs'

/**
 * Check if a value looks like a date (Date object or ISO date string).
 */
export function isDateValue(value: unknown): boolean {
  if (value instanceof Date) return true
  if (typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}/.test(value) && dayjs(value).isValid()
}

/**
 * Format a date value as `YYYY-MM-DD HH:mm:ss`.
 * Used for data grid cells, database timestamps, etc.
 */
export function formatDateTime(value: unknown): string {
  if (!value) return '-'
  return dayjs(value as string | Date).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * Format a date value as `MMM D, YYYY, HH:mm`.
 * Used for human-friendly display (e.g. connection last used).
 */
export function formatDateShort(value: unknown): string {
  if (!value) return 'Never'
  return dayjs(value as string | Date).format('MMM D, YYYY, HH:mm')
}

/**
 * Format a date value as `HH:mm:ss`.
 * Used for time-only display (e.g. query history).
 */
export function formatTime(value: unknown): string {
  if (!value) return '-'
  return dayjs(value as string | Date).format('HH:mm:ss')
}
