/**
 * Check if a column type is a boolean type.
 * Matches PostgreSQL BOOLEAN/BOOL, ClickHouse Bool/Nullable(Bool), MongoDB Boolean.
 * Does NOT match MySQL TINYINT(1) or SQLite (no native boolean).
 */
export const isBooleanColumnType = (type: string): boolean => {
  return type.toUpperCase().includes('BOOL')
}

/**
 * Parse various boolean representations to boolean | null.
 * Handles: true/false, 1/0, 't'/'f', 'yes'/'no', null/undefined.
 */
export const parseBooleanValue = (value: unknown): boolean | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.toLowerCase().trim()
    if (v === 'true' || v === 't' || v === '1' || v === 'yes') return true
    if (v === 'false' || v === 'f' || v === '0' || v === 'no') return false
    if (v === 'null' || v === '') return null
  }
  return null
}
