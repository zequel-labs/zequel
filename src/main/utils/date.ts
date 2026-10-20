/** Retain milliseconds and timezone for Date values; database text keeps its full precision. */
export const formatExportDate = (value: Date | string): string => value instanceof Date ? value.toISOString() : value

export const isDate = (value: unknown): value is Date => value instanceof Date
