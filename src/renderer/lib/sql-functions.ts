import { DatabaseType } from '@/types/connection'
import type { SqlDialect } from './sql-formatter'

export interface SqlFunction {
  name: string
  signature: string
  description: string
  category: 'aggregate' | 'string' | 'date' | 'math' | 'conversion' | 'window' | 'json' | 'other'
}

const commonFunctions: SqlFunction[] = [
  // Aggregate functions
  { name: 'COUNT', signature: 'COUNT(expression)', description: 'Count rows', category: 'aggregate' },
  { name: 'SUM', signature: 'SUM(expression)', description: 'Sum values', category: 'aggregate' },
  { name: 'AVG', signature: 'AVG(expression)', description: 'Average value', category: 'aggregate' },
  { name: 'MIN', signature: 'MIN(expression)', description: 'Minimum value', category: 'aggregate' },
  { name: 'MAX', signature: 'MAX(expression)', description: 'Maximum value', category: 'aggregate' },

  // String functions
  { name: 'UPPER', signature: 'UPPER(string)', description: 'Uppercase', category: 'string' },
  { name: 'LOWER', signature: 'LOWER(string)', description: 'Lowercase', category: 'string' },
  { name: 'TRIM', signature: 'TRIM(string)', description: 'Trim whitespace', category: 'string' },
  { name: 'LENGTH', signature: 'LENGTH(string)', description: 'String length', category: 'string' },
  { name: 'SUBSTRING', signature: 'SUBSTRING(str, start, length)', description: 'Extract substring', category: 'string' },
  { name: 'REPLACE', signature: 'REPLACE(str, from, to)', description: 'Replace string', category: 'string' },
  { name: 'CONCAT', signature: 'CONCAT(str1, str2, ...)', description: 'Concatenate strings', category: 'string' },

  // Math functions
  { name: 'ABS', signature: 'ABS(number)', description: 'Absolute value', category: 'math' },
  { name: 'ROUND', signature: 'ROUND(number, decimals)', description: 'Round number', category: 'math' },
  { name: 'CEIL', signature: 'CEIL(number)', description: 'Round up', category: 'math' },
  { name: 'FLOOR', signature: 'FLOOR(number)', description: 'Round down', category: 'math' },

  // Conversion / other
  { name: 'COALESCE', signature: 'COALESCE(val1, val2, ...)', description: 'First non-null value', category: 'other' },
  { name: 'CAST', signature: 'CAST(expr AS type)', description: 'Type conversion', category: 'conversion' },
  { name: 'NULLIF', signature: 'NULLIF(expr1, expr2)', description: 'Return null if equal', category: 'other' },
]

const postgresSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'NOW', signature: 'NOW()', description: 'Current timestamp', category: 'date' },
  { name: 'CURRENT_DATE', signature: 'CURRENT_DATE', description: 'Current date', category: 'date' },
  { name: 'CURRENT_TIMESTAMP', signature: 'CURRENT_TIMESTAMP', description: 'Current timestamp', category: 'date' },
  { name: 'AGE', signature: 'AGE(timestamp, timestamp)', description: 'Time interval between timestamps', category: 'date' },
  { name: 'DATE_TRUNC', signature: "DATE_TRUNC('unit', timestamp)", description: 'Truncate date to specified precision', category: 'date' },
  { name: 'EXTRACT', signature: 'EXTRACT(field FROM source)', description: 'Extract date/time part', category: 'date' },
  { name: 'DATE_PART', signature: "DATE_PART('field', source)", description: 'Extract date/time part (legacy)', category: 'date' },

  // Conversion
  { name: 'TO_CHAR', signature: 'TO_CHAR(value, format)', description: 'Format value to string', category: 'conversion' },
  { name: 'TO_DATE', signature: 'TO_DATE(string, format)', description: 'Parse string to date', category: 'conversion' },
  { name: 'TO_NUMBER', signature: 'TO_NUMBER(string, format)', description: 'Parse string to number', category: 'conversion' },
  { name: 'TO_TIMESTAMP', signature: 'TO_TIMESTAMP(string, format)', description: 'Parse string to timestamp', category: 'conversion' },

  // Aggregate
  { name: 'STRING_AGG', signature: 'STRING_AGG(expr, delimiter)', description: 'Aggregate strings with delimiter', category: 'aggregate' },
  { name: 'ARRAY_AGG', signature: 'ARRAY_AGG(expr)', description: 'Aggregate values to array', category: 'aggregate' },
  { name: 'JSON_AGG', signature: 'JSON_AGG(expr)', description: 'Aggregate values to JSON array', category: 'aggregate' },
  { name: 'BOOL_AND', signature: 'BOOL_AND(expr)', description: 'Logical AND aggregate', category: 'aggregate' },
  { name: 'BOOL_OR', signature: 'BOOL_OR(expr)', description: 'Logical OR aggregate', category: 'aggregate' },

  // JSON
  { name: 'JSON_BUILD_OBJECT', signature: 'JSON_BUILD_OBJECT(key, value, ...)', description: 'Build JSON object from key-value pairs', category: 'json' },
  { name: 'JSON_BUILD_ARRAY', signature: 'JSON_BUILD_ARRAY(val, ...)', description: 'Build JSON array', category: 'json' },
  { name: 'JSONB_EXTRACT_PATH_TEXT', signature: 'JSONB_EXTRACT_PATH_TEXT(json, path...)', description: 'Extract JSON text value at path', category: 'json' },
  { name: 'JSONB_SET', signature: 'JSONB_SET(target, path, new_value)', description: 'Set value in JSON', category: 'json' },
  { name: 'ROW_TO_JSON', signature: 'ROW_TO_JSON(record)', description: 'Convert row to JSON', category: 'json' },

  // Window
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', description: 'Row number window function', category: 'window' },
  { name: 'RANK', signature: 'RANK() OVER (...)', description: 'Rank with gaps window function', category: 'window' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', description: 'Dense rank window function', category: 'window' },
  { name: 'LAG', signature: 'LAG(value, offset) OVER (...)', description: 'Access previous row value', category: 'window' },
  { name: 'LEAD', signature: 'LEAD(value, offset) OVER (...)', description: 'Access next row value', category: 'window' },
  { name: 'FIRST_VALUE', signature: 'FIRST_VALUE(expr) OVER (...)', description: 'First value in window frame', category: 'window' },
  { name: 'LAST_VALUE', signature: 'LAST_VALUE(expr) OVER (...)', description: 'Last value in window frame', category: 'window' },
  { name: 'NTH_VALUE', signature: 'NTH_VALUE(expr, n) OVER (...)', description: 'Nth value in window frame', category: 'window' },
  { name: 'NTILE', signature: 'NTILE(num_buckets) OVER (...)', description: 'Distribute rows into buckets', category: 'window' },

  // Other
  { name: 'GENERATE_SERIES', signature: 'GENERATE_SERIES(start, stop, step)', description: 'Generate a series of values', category: 'other' },
  { name: 'GREATEST', signature: 'GREATEST(val1, val2, ...)', description: 'Return greatest value', category: 'other' },
  { name: 'LEAST', signature: 'LEAST(val1, val2, ...)', description: 'Return least value', category: 'other' },

  // String extras
  { name: 'LEFT', signature: 'LEFT(string, n)', description: 'First n characters', category: 'string' },
  { name: 'RIGHT', signature: 'RIGHT(string, n)', description: 'Last n characters', category: 'string' },
  { name: 'INITCAP', signature: 'INITCAP(string)', description: 'Capitalize first letter of each word', category: 'string' },
  { name: 'REGEXP_REPLACE', signature: 'REGEXP_REPLACE(string, pattern, replacement)', description: 'Replace using regex', category: 'string' },
  { name: 'REGEXP_MATCHES', signature: 'REGEXP_MATCHES(string, pattern)', description: 'Extract regex matches', category: 'string' },
]

const mysqlSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'NOW', signature: 'NOW()', description: 'Current datetime', category: 'date' },
  { name: 'CURDATE', signature: 'CURDATE()', description: 'Current date', category: 'date' },
  { name: 'CURTIME', signature: 'CURTIME()', description: 'Current time', category: 'date' },
  { name: 'DATE_FORMAT', signature: "DATE_FORMAT(date, format)", description: 'Format date to string', category: 'date' },
  { name: 'DATEDIFF', signature: 'DATEDIFF(date1, date2)', description: 'Difference in days between dates', category: 'date' },
  { name: 'DATE_ADD', signature: 'DATE_ADD(date, INTERVAL n unit)', description: 'Add interval to date', category: 'date' },
  { name: 'DATE_SUB', signature: 'DATE_SUB(date, INTERVAL n unit)', description: 'Subtract interval from date', category: 'date' },
  { name: 'STR_TO_DATE', signature: "STR_TO_DATE(string, format)", description: 'Parse string to date', category: 'date' },
  { name: 'YEAR', signature: 'YEAR(date)', description: 'Extract year', category: 'date' },
  { name: 'MONTH', signature: 'MONTH(date)', description: 'Extract month', category: 'date' },
  { name: 'DAY', signature: 'DAY(date)', description: 'Extract day', category: 'date' },

  // Conditional
  { name: 'IFNULL', signature: 'IFNULL(expr, default)', description: 'Return default if expr is null', category: 'other' },
  { name: 'IF', signature: 'IF(condition, then, else)', description: 'Conditional expression', category: 'other' },
  { name: 'NULLIF', signature: 'NULLIF(expr1, expr2)', description: 'Return null if equal', category: 'other' },

  // Aggregate
  { name: 'GROUP_CONCAT', signature: 'GROUP_CONCAT(expr SEPARATOR sep)', description: 'Aggregate strings with separator', category: 'aggregate' },

  // JSON
  { name: 'JSON_EXTRACT', signature: "JSON_EXTRACT(json, '$.path')", description: 'Extract value from JSON', category: 'json' },
  { name: 'JSON_OBJECT', signature: 'JSON_OBJECT(key, val, ...)', description: 'Build JSON object', category: 'json' },
  { name: 'JSON_ARRAY', signature: 'JSON_ARRAY(val, ...)', description: 'Build JSON array', category: 'json' },
  { name: 'JSON_SET', signature: "JSON_SET(json, '$.path', value)", description: 'Set value in JSON', category: 'json' },
  { name: 'JSON_UNQUOTE', signature: 'JSON_UNQUOTE(json_val)', description: 'Unquote JSON string value', category: 'json' },

  // Window
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', description: 'Row number window function', category: 'window' },
  { name: 'RANK', signature: 'RANK() OVER (...)', description: 'Rank with gaps window function', category: 'window' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', description: 'Dense rank window function', category: 'window' },
  { name: 'LAG', signature: 'LAG(value, offset) OVER (...)', description: 'Access previous row value', category: 'window' },
  { name: 'LEAD', signature: 'LEAD(value, offset) OVER (...)', description: 'Access next row value', category: 'window' },

  // String extras
  { name: 'LEFT', signature: 'LEFT(string, n)', description: 'First n characters', category: 'string' },
  { name: 'RIGHT', signature: 'RIGHT(string, n)', description: 'Last n characters', category: 'string' },
  { name: 'LPAD', signature: 'LPAD(string, length, pad_string)', description: 'Left-pad string', category: 'string' },
  { name: 'RPAD', signature: 'RPAD(string, length, pad_string)', description: 'Right-pad string', category: 'string' },
  { name: 'REGEXP_REPLACE', signature: 'REGEXP_REPLACE(string, pattern, replacement)', description: 'Replace using regex', category: 'string' },
]

const sqliteSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'DATE', signature: "DATE(timestring, modifier, ...)", description: 'Return date string', category: 'date' },
  { name: 'TIME', signature: "TIME(timestring, modifier, ...)", description: 'Return time string', category: 'date' },
  { name: 'DATETIME', signature: "DATETIME(timestring, modifier, ...)", description: 'Return datetime string', category: 'date' },
  { name: 'JULIANDAY', signature: "JULIANDAY(timestring, modifier, ...)", description: 'Return Julian day number', category: 'date' },
  { name: 'STRFTIME', signature: "STRFTIME(format, timestring, modifier, ...)", description: 'Format date/time string', category: 'date' },

  // Aggregate
  { name: 'GROUP_CONCAT', signature: 'GROUP_CONCAT(expr, separator)', description: 'Aggregate strings with separator', category: 'aggregate' },
  { name: 'TOTAL', signature: 'TOTAL(expr)', description: 'Sum returning float (never null)', category: 'aggregate' },

  // Other
  { name: 'TYPEOF', signature: 'TYPEOF(expr)', description: 'Return type name of expression', category: 'other' },
  { name: 'IFNULL', signature: 'IFNULL(expr, default)', description: 'Return default if expr is null', category: 'other' },
  { name: 'IIF', signature: 'IIF(condition, then, else)', description: 'Inline conditional', category: 'other' },
  { name: 'INSTR', signature: 'INSTR(string, search)', description: 'Find position of substring', category: 'string' },
  { name: 'UNICODE', signature: 'UNICODE(string)', description: 'Unicode code point of first char', category: 'string' },
  { name: 'ZEROBLOB', signature: 'ZEROBLOB(n)', description: 'Create n-byte zero-filled blob', category: 'other' },
  { name: 'GLOB', signature: 'GLOB(pattern, string)', description: 'Unix-style glob matching', category: 'string' },
  { name: 'LIKELIHOOD', signature: 'LIKELIHOOD(expr, probability)', description: 'Hint probability of expression', category: 'other' },
]

const clickhouseSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'now', signature: 'now()', description: 'Current date and time', category: 'date' },
  { name: 'today', signature: 'today()', description: 'Current date', category: 'date' },
  { name: 'toDate', signature: 'toDate(expr)', description: 'Convert to Date', category: 'date' },
  { name: 'toDateTime', signature: 'toDateTime(expr)', description: 'Convert to DateTime', category: 'date' },
  { name: 'formatDateTime', signature: "formatDateTime(time, format)", description: 'Format DateTime to string', category: 'date' },
  { name: 'dateDiff', signature: "dateDiff('unit', start, end)", description: 'Difference between dates', category: 'date' },
  { name: 'toStartOfMonth', signature: 'toStartOfMonth(date)', description: 'Round down to start of month', category: 'date' },
  { name: 'toStartOfWeek', signature: 'toStartOfWeek(date)', description: 'Round down to start of week', category: 'date' },
  { name: 'toStartOfDay', signature: 'toStartOfDay(datetime)', description: 'Round down to start of day', category: 'date' },
  { name: 'toStartOfHour', signature: 'toStartOfHour(datetime)', description: 'Round down to start of hour', category: 'date' },
  { name: 'toYear', signature: 'toYear(date)', description: 'Extract year', category: 'date' },
  { name: 'toMonth', signature: 'toMonth(date)', description: 'Extract month', category: 'date' },
  { name: 'toDayOfMonth', signature: 'toDayOfMonth(date)', description: 'Extract day of month', category: 'date' },

  // String
  { name: 'toString', signature: 'toString(value)', description: 'Convert to string', category: 'string' },
  { name: 'toFixedString', signature: 'toFixedString(s, n)', description: 'Convert to fixed-length string', category: 'string' },
  { name: 'splitByChar', signature: "splitByChar(separator, s)", description: 'Split string by character', category: 'string' },
  { name: 'splitByString', signature: "splitByString(separator, s)", description: 'Split string by string', category: 'string' },
  { name: 'extractAll', signature: "extractAll(text, regexp)", description: 'Extract all regex matches', category: 'string' },
  { name: 'positionCaseInsensitive', signature: 'positionCaseInsensitive(haystack, needle)', description: 'Case-insensitive position of substring', category: 'string' },
  { name: 'replaceAll', signature: 'replaceAll(haystack, pattern, replacement)', description: 'Replace all occurrences', category: 'string' },

  // Array
  { name: 'arrayJoin', signature: 'arrayJoin(arr)', description: 'Unfold array into rows', category: 'other' },
  { name: 'arrayMap', signature: 'arrayMap(func, arr)', description: 'Apply function to each array element', category: 'other' },
  { name: 'arrayFilter', signature: 'arrayFilter(func, arr)', description: 'Filter array elements', category: 'other' },
  { name: 'arrayExists', signature: 'arrayExists(func, arr)', description: 'Check if any element matches', category: 'other' },
  { name: 'groupArray', signature: 'groupArray(expr)', description: 'Aggregate values into array', category: 'aggregate' },
  { name: 'groupUniqArray', signature: 'groupUniqArray(expr)', description: 'Aggregate unique values into array', category: 'aggregate' },
  { name: 'arraySort', signature: 'arraySort(arr)', description: 'Sort array elements', category: 'other' },

  // Aggregate
  { name: 'uniq', signature: 'uniq(expr)', description: 'Approximate distinct count', category: 'aggregate' },
  { name: 'uniqExact', signature: 'uniqExact(expr)', description: 'Exact distinct count', category: 'aggregate' },
  { name: 'quantile', signature: 'quantile(level)(expr)', description: 'Approximate quantile', category: 'aggregate' },
  { name: 'quantiles', signature: 'quantiles(level1, level2, ...)(expr)', description: 'Approximate quantiles', category: 'aggregate' },
  { name: 'argMin', signature: 'argMin(arg, val)', description: 'Value of arg at minimum val', category: 'aggregate' },
  { name: 'argMax', signature: 'argMax(arg, val)', description: 'Value of arg at maximum val', category: 'aggregate' },
  { name: 'sumIf', signature: 'sumIf(column, condition)', description: 'Conditional sum', category: 'aggregate' },
  { name: 'countIf', signature: 'countIf(condition)', description: 'Conditional count', category: 'aggregate' },
  { name: 'avgIf', signature: 'avgIf(column, condition)', description: 'Conditional average', category: 'aggregate' },
  { name: 'any', signature: 'any(expr)', description: 'Select any value from group', category: 'aggregate' },
  { name: 'anyLast', signature: 'anyLast(expr)', description: 'Select last value from group', category: 'aggregate' },

  // Conditional
  { name: 'if', signature: 'if(condition, then, else)', description: 'Conditional expression', category: 'other' },
  { name: 'multiIf', signature: 'multiIf(cond1, then1, cond2, then2, ..., else)', description: 'Multi-way conditional', category: 'other' },

  // Table functions
  { name: 'numbers', signature: 'numbers(n)', description: 'Generate sequence 0..n-1', category: 'other' },
  { name: 'generateRandom', signature: "generateRandom('name Type, ...')", description: 'Generate random data', category: 'other' },

  // Other
  { name: 'dictGet', signature: "dictGet('dict_name', 'attr', id)", description: 'Get value from external dictionary', category: 'other' },
  { name: 'tupleElement', signature: 'tupleElement(tuple, n)', description: 'Get tuple element by index', category: 'other' },
  { name: 'toTypeName', signature: 'toTypeName(expr)', description: 'Get type name of expression', category: 'other' },

  // Window
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', description: 'Row number window function', category: 'window' },
  { name: 'RANK', signature: 'RANK() OVER (...)', description: 'Rank with gaps window function', category: 'window' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', description: 'Dense rank window function', category: 'window' },
  { name: 'LAG', signature: 'LAG(value, offset) OVER (...)', description: 'Access previous row value', category: 'window' },
  { name: 'LEAD', signature: 'LEAD(value, offset) OVER (...)', description: 'Access next row value', category: 'window' },
]

/**
 * Get SQL functions available for a given dialect.
 * Returns common functions shared across all dialects plus dialect-specific functions.
 */
export const getFunctionsForDialect = (dialect: SqlDialect): SqlFunction[] => {
  switch (dialect) {
    case DatabaseType.PostgreSQL:
      return [...commonFunctions, ...postgresSpecificFunctions]
    case DatabaseType.MySQL:
    case DatabaseType.MariaDB:
      return [...commonFunctions, ...mysqlSpecificFunctions]
    case DatabaseType.SQLite:
      return [...commonFunctions, ...sqliteSpecificFunctions]
    case DatabaseType.ClickHouse:
      return [...commonFunctions, ...clickhouseSpecificFunctions]
    default:
      return commonFunctions
  }
}
