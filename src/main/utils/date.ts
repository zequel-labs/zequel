import dayjs from 'dayjs'

/**
 * Format a value as a date string suitable for SQL/CSV export.
 * Returns `YYYY-MM-DD HH:mm:ss` for Date objects and date-like strings.
 * Returns the original string for non-date values.
 */
export const formatExportDate = (value: Date | string): string => {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * Check if a value is a Date instance.
 */
export const isDate = (value: unknown): value is Date => {
  return value instanceof Date
}
