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

const duckdbSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'NOW', signature: 'NOW()', description: 'Current timestamp', category: 'date' },
  { name: 'CURRENT_DATE', signature: 'CURRENT_DATE', description: 'Current date', category: 'date' },
  { name: 'CURRENT_TIMESTAMP', signature: 'CURRENT_TIMESTAMP', description: 'Current timestamp', category: 'date' },
  { name: 'DATE_TRUNC', signature: "DATE_TRUNC('unit', timestamp)", description: 'Truncate date to specified precision', category: 'date' },
  { name: 'DATE_PART', signature: "DATE_PART('field', source)", description: 'Extract date/time part', category: 'date' },
  { name: 'EXTRACT', signature: 'EXTRACT(field FROM source)', description: 'Extract date/time part (SQL standard)', category: 'date' },
  { name: 'DATE_DIFF', signature: "DATE_DIFF('unit', start, end)", description: 'Difference between dates in units', category: 'date' },
  { name: 'DATE_ADD', signature: "DATE_ADD(date, INTERVAL n unit)", description: 'Add interval to date', category: 'date' },
  { name: 'DATE_SUB', signature: "DATE_SUB(date, INTERVAL n unit)", description: 'Subtract interval from date', category: 'date' },
  { name: 'AGE', signature: 'AGE(timestamp, timestamp)', description: 'Time interval between timestamps', category: 'date' },
  { name: 'EPOCH_MS', signature: 'EPOCH_MS(milliseconds)', description: 'Convert epoch milliseconds to timestamp', category: 'date' },
  { name: 'EPOCH', signature: 'EPOCH(timestamp)', description: 'Convert timestamp to epoch seconds', category: 'date' },
  { name: 'MAKE_DATE', signature: 'MAKE_DATE(year, month, day)', description: 'Create date from parts', category: 'date' },
  { name: 'MAKE_TIMESTAMP', signature: 'MAKE_TIMESTAMP(year, month, day, hour, min, sec)', description: 'Create timestamp from parts', category: 'date' },
  { name: 'STRFTIME', signature: "STRFTIME('format', timestamp)", description: 'Format timestamp to string', category: 'date' },
  { name: 'STRPTIME', signature: "STRPTIME(string, 'format')", description: 'Parse string to timestamp', category: 'date' },

  // Aggregate
  { name: 'STRING_AGG', signature: 'STRING_AGG(expr, delimiter)', description: 'Aggregate strings with delimiter', category: 'aggregate' },
  { name: 'ARRAY_AGG', signature: 'ARRAY_AGG(expr)', description: 'Aggregate values to array', category: 'aggregate' },
  { name: 'LIST', signature: 'LIST(expr)', description: 'Aggregate values into a list', category: 'aggregate' },
  { name: 'FIRST', signature: 'FIRST(expr)', description: 'First value in group', category: 'aggregate' },
  { name: 'LAST', signature: 'LAST(expr)', description: 'Last value in group', category: 'aggregate' },
  { name: 'BOOL_AND', signature: 'BOOL_AND(expr)', description: 'Logical AND aggregate', category: 'aggregate' },
  { name: 'BOOL_OR', signature: 'BOOL_OR(expr)', description: 'Logical OR aggregate', category: 'aggregate' },
  { name: 'MEDIAN', signature: 'MEDIAN(expr)', description: 'Median value of group', category: 'aggregate' },
  { name: 'MODE', signature: 'MODE(expr)', description: 'Most frequent value in group', category: 'aggregate' },
  { name: 'QUANTILE_CONT', signature: 'QUANTILE_CONT(expr, fraction)', description: 'Continuous quantile of group', category: 'aggregate' },
  { name: 'QUANTILE_DISC', signature: 'QUANTILE_DISC(expr, fraction)', description: 'Discrete quantile of group', category: 'aggregate' },
  { name: 'APPROX_COUNT_DISTINCT', signature: 'APPROX_COUNT_DISTINCT(expr)', description: 'Approximate distinct count', category: 'aggregate' },
  { name: 'ARG_MIN', signature: 'ARG_MIN(arg, val)', description: 'Value of arg at minimum val', category: 'aggregate' },
  { name: 'ARG_MAX', signature: 'ARG_MAX(arg, val)', description: 'Value of arg at maximum val', category: 'aggregate' },
  { name: 'BIT_AND', signature: 'BIT_AND(expr)', description: 'Bitwise AND aggregate', category: 'aggregate' },
  { name: 'BIT_OR', signature: 'BIT_OR(expr)', description: 'Bitwise OR aggregate', category: 'aggregate' },
  { name: 'BIT_XOR', signature: 'BIT_XOR(expr)', description: 'Bitwise XOR aggregate', category: 'aggregate' },

  // List/Array
  { name: 'LIST_VALUE', signature: 'LIST_VALUE(val1, val2, ...)', description: 'Create a list from values', category: 'other' },
  { name: 'LIST_SORT', signature: 'LIST_SORT(list)', description: 'Sort a list', category: 'other' },
  { name: 'LIST_FILTER', signature: 'LIST_FILTER(list, lambda)', description: 'Filter list elements with lambda', category: 'other' },
  { name: 'LIST_TRANSFORM', signature: 'LIST_TRANSFORM(list, lambda)', description: 'Transform list elements with lambda', category: 'other' },
  { name: 'LIST_CONTAINS', signature: 'LIST_CONTAINS(list, element)', description: 'Check if list contains element', category: 'other' },
  { name: 'LIST_AGGREGATE', signature: "LIST_AGGREGATE(list, 'name')", description: 'Run aggregate function on list', category: 'other' },
  { name: 'LIST_DISTINCT', signature: 'LIST_DISTINCT(list)', description: 'Remove duplicate list elements', category: 'other' },
  { name: 'ARRAY_LENGTH', signature: 'ARRAY_LENGTH(list)', description: 'Number of elements in list', category: 'other' },
  { name: 'FLATTEN', signature: 'FLATTEN(nested_list)', description: 'Flatten nested list one level', category: 'other' },
  { name: 'GENERATE_SERIES', signature: 'GENERATE_SERIES(start, stop, step)', description: 'Generate a series of values', category: 'other' },
  { name: 'RANGE', signature: 'RANGE(start, stop, step)', description: 'Generate a range (exclusive end)', category: 'other' },
  { name: 'UNNEST', signature: 'UNNEST(list)', description: 'Expand a list into rows', category: 'other' },

  // Struct/Map
  { name: 'STRUCT_PACK', signature: "STRUCT_PACK(key := val, ...)", description: 'Create a struct from key-value pairs', category: 'other' },
  { name: 'STRUCT_EXTRACT', signature: "STRUCT_EXTRACT(struct, 'field')", description: 'Extract field from struct', category: 'other' },
  { name: 'MAP', signature: 'MAP([keys], [values])', description: 'Create a map from key/value lists', category: 'other' },
  { name: 'MAP_KEYS', signature: 'MAP_KEYS(map)', description: 'Extract keys from map', category: 'other' },
  { name: 'MAP_VALUES', signature: 'MAP_VALUES(map)', description: 'Extract values from map', category: 'other' },

  // String
  { name: 'REGEXP_EXTRACT', signature: "REGEXP_EXTRACT(string, pattern)", description: 'Extract first regex match', category: 'string' },
  { name: 'REGEXP_REPLACE', signature: 'REGEXP_REPLACE(string, pattern, replacement)', description: 'Replace using regex', category: 'string' },
  { name: 'REGEXP_MATCHES', signature: 'REGEXP_MATCHES(string, pattern)', description: 'Check if string matches regex', category: 'string' },
  { name: 'LEFT', signature: 'LEFT(string, n)', description: 'First n characters', category: 'string' },
  { name: 'RIGHT', signature: 'RIGHT(string, n)', description: 'Last n characters', category: 'string' },
  { name: 'LPAD', signature: 'LPAD(string, length, pad)', description: 'Left-pad string', category: 'string' },
  { name: 'RPAD', signature: 'RPAD(string, length, pad)', description: 'Right-pad string', category: 'string' },
  { name: 'INITCAP', signature: 'INITCAP(string)', description: 'Capitalize first letter of each word', category: 'string' },
  { name: 'STARTS_WITH', signature: 'STARTS_WITH(string, prefix)', description: 'Check if string starts with prefix', category: 'string' },
  { name: 'CONTAINS', signature: 'CONTAINS(string, search)', description: 'Check if string contains search', category: 'string' },
  { name: 'STRIP_ACCENTS', signature: 'STRIP_ACCENTS(string)', description: 'Remove accents from characters', category: 'string' },
  { name: 'STRING_SPLIT', signature: "STRING_SPLIT(string, separator)", description: 'Split string into list', category: 'string' },
  { name: 'FORMAT', signature: "FORMAT('{}', val1, ...)", description: 'Format string with placeholders', category: 'string' },
  { name: 'PRINTF', signature: "PRINTF('format', val1, ...)", description: 'C-style format string', category: 'string' },

  // Conversion
  { name: 'TRY_CAST', signature: 'TRY_CAST(expr AS type)', description: 'Safe cast returning NULL on failure', category: 'conversion' },

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
  { name: 'PERCENT_RANK', signature: 'PERCENT_RANK() OVER (...)', description: 'Relative rank as percentage', category: 'window' },
  { name: 'CUME_DIST', signature: 'CUME_DIST() OVER (...)', description: 'Cumulative distribution', category: 'window' },

  // JSON
  { name: 'JSON_EXTRACT', signature: "JSON_EXTRACT(json, '$.path')", description: 'Extract value from JSON', category: 'json' },
  { name: 'JSON_EXTRACT_STRING', signature: "JSON_EXTRACT_STRING(json, '$.path')", description: 'Extract string from JSON', category: 'json' },
  { name: 'JSON_OBJECT', signature: 'JSON_OBJECT(key, val, ...)', description: 'Build JSON object', category: 'json' },
  { name: 'JSON_ARRAY', signature: 'JSON_ARRAY(val, ...)', description: 'Build JSON array', category: 'json' },
  { name: 'JSON_KEYS', signature: "JSON_KEYS(json, '$.path')", description: 'Get keys from JSON object', category: 'json' },
  { name: 'JSON_TYPE', signature: "JSON_TYPE(json, '$.path')", description: 'Get type of JSON value', category: 'json' },
  { name: 'JSON_VALID', signature: 'JSON_VALID(string)', description: 'Check if string is valid JSON', category: 'json' },
  { name: 'JSON_ARRAY_LENGTH', signature: "JSON_ARRAY_LENGTH(json, '$.path')", description: 'Get length of JSON array', category: 'json' },
  { name: 'TO_JSON', signature: 'TO_JSON(value)', description: 'Convert value to JSON', category: 'json' },
  { name: 'JSON_MERGE_PATCH', signature: 'JSON_MERGE_PATCH(json1, json2)', description: 'Merge two JSON values', category: 'json' },

  // File reading (DuckDB-specific)
  { name: 'READ_CSV', signature: "READ_CSV('path', options...)", description: 'Read CSV file as table', category: 'other' },
  { name: 'READ_PARQUET', signature: "READ_PARQUET('path')", description: 'Read Parquet file as table', category: 'other' },
  { name: 'READ_JSON', signature: "READ_JSON('path', options...)", description: 'Read JSON file as table', category: 'other' },

  // Other
  { name: 'TYPEOF', signature: 'TYPEOF(expr)', description: 'Return type name of expression', category: 'other' },
  { name: 'IFNULL', signature: 'IFNULL(expr, default)', description: 'Return default if expr is null', category: 'other' },
  { name: 'GREATEST', signature: 'GREATEST(val1, val2, ...)', description: 'Return greatest value', category: 'other' },
  { name: 'LEAST', signature: 'LEAST(val1, val2, ...)', description: 'Return least value', category: 'other' },
  { name: 'HASH', signature: 'HASH(value)', description: 'Hash a value', category: 'other' },
  { name: 'MD5', signature: 'MD5(string)', description: 'MD5 hash of string', category: 'other' },
]

const sqlserverSpecificFunctions: SqlFunction[] = [
  // Date/time
  { name: 'GETDATE', signature: 'GETDATE()', description: 'Current date and time', category: 'date' },
  { name: 'GETUTCDATE', signature: 'GETUTCDATE()', description: 'Current UTC date and time', category: 'date' },
  { name: 'SYSDATETIME', signature: 'SYSDATETIME()', description: 'Current date and time (high precision)', category: 'date' },
  { name: 'SYSUTCDATETIME', signature: 'SYSUTCDATETIME()', description: 'Current UTC date and time (high precision)', category: 'date' },
  { name: 'DATEADD', signature: 'DATEADD(datepart, number, date)', description: 'Add interval to date', category: 'date' },
  { name: 'DATEDIFF', signature: 'DATEDIFF(datepart, startdate, enddate)', description: 'Difference between dates', category: 'date' },
  { name: 'DATEDIFF_BIG', signature: 'DATEDIFF_BIG(datepart, startdate, enddate)', description: 'Difference between dates (bigint)', category: 'date' },
  { name: 'DATEPART', signature: 'DATEPART(datepart, date)', description: 'Extract date part as integer', category: 'date' },
  { name: 'DATENAME', signature: 'DATENAME(datepart, date)', description: 'Extract date part as string', category: 'date' },
  { name: 'YEAR', signature: 'YEAR(date)', description: 'Extract year', category: 'date' },
  { name: 'MONTH', signature: 'MONTH(date)', description: 'Extract month', category: 'date' },
  { name: 'DAY', signature: 'DAY(date)', description: 'Extract day', category: 'date' },
  { name: 'EOMONTH', signature: 'EOMONTH(start_date, months)', description: 'Last day of month', category: 'date' },
  { name: 'DATEFROMPARTS', signature: 'DATEFROMPARTS(year, month, day)', description: 'Create date from parts', category: 'date' },
  { name: 'ISDATE', signature: 'ISDATE(expression)', description: 'Check if valid date', category: 'date' },
  { name: 'FORMAT', signature: "FORMAT(value, format)", description: 'Format value using .NET format string', category: 'date' },

  // Conversion
  { name: 'CONVERT', signature: 'CONVERT(data_type, expression, style)', description: 'Convert with style formatting', category: 'conversion' },
  { name: 'TRY_CAST', signature: 'TRY_CAST(expression AS data_type)', description: 'Safe cast returning NULL on failure', category: 'conversion' },
  { name: 'TRY_CONVERT', signature: 'TRY_CONVERT(data_type, expression, style)', description: 'Safe convert returning NULL on failure', category: 'conversion' },
  { name: 'PARSE', signature: 'PARSE(string AS data_type USING culture)', description: 'Parse string to date/number using culture', category: 'conversion' },
  { name: 'TRY_PARSE', signature: 'TRY_PARSE(string AS data_type USING culture)', description: 'Safe parse returning NULL on failure', category: 'conversion' },

  // String
  { name: 'LEN', signature: 'LEN(string)', description: 'String length (without trailing spaces)', category: 'string' },
  { name: 'DATALENGTH', signature: 'DATALENGTH(expression)', description: 'Number of bytes in expression', category: 'string' },
  { name: 'LEFT', signature: 'LEFT(string, n)', description: 'First n characters', category: 'string' },
  { name: 'RIGHT', signature: 'RIGHT(string, n)', description: 'Last n characters', category: 'string' },
  { name: 'CHARINDEX', signature: 'CHARINDEX(search, string, start)', description: 'Find position of substring', category: 'string' },
  { name: 'PATINDEX', signature: "PATINDEX('%pattern%', string)", description: 'Find position of pattern', category: 'string' },
  { name: 'STUFF', signature: 'STUFF(string, start, length, insert)', description: 'Insert string into another', category: 'string' },
  { name: 'STRING_AGG', signature: "STRING_AGG(expression, separator)", description: 'Aggregate strings with separator', category: 'aggregate' },
  { name: 'REVERSE', signature: 'REVERSE(string)', description: 'Reverse string', category: 'string' },
  { name: 'REPLICATE', signature: 'REPLICATE(string, count)', description: 'Repeat string n times', category: 'string' },
  { name: 'SPACE', signature: 'SPACE(count)', description: 'String of spaces', category: 'string' },
  { name: 'LTRIM', signature: 'LTRIM(string)', description: 'Trim leading spaces', category: 'string' },
  { name: 'RTRIM', signature: 'RTRIM(string)', description: 'Trim trailing spaces', category: 'string' },
  { name: 'STRING_SPLIT', signature: "STRING_SPLIT(string, separator)", description: 'Split string into rows', category: 'string' },
  { name: 'TRANSLATE', signature: 'TRANSLATE(string, from, to)', description: 'Replace characters', category: 'string' },
  { name: 'QUOTENAME', signature: 'QUOTENAME(string, quote_char)', description: 'Add delimiters to identifier', category: 'string' },

  // Math
  { name: 'POWER', signature: 'POWER(base, exponent)', description: 'Raise to power', category: 'math' },
  { name: 'SQUARE', signature: 'SQUARE(number)', description: 'Square of number', category: 'math' },
  { name: 'SQRT', signature: 'SQRT(number)', description: 'Square root', category: 'math' },
  { name: 'SIGN', signature: 'SIGN(number)', description: 'Sign of number (-1, 0, 1)', category: 'math' },
  { name: 'RAND', signature: 'RAND(seed)', description: 'Random float 0-1', category: 'math' },
  { name: 'NEWID', signature: 'NEWID()', description: 'Generate unique identifier (GUID)', category: 'other' },

  // Aggregate
  { name: 'COUNT_BIG', signature: 'COUNT_BIG(expression)', description: 'Count rows (bigint)', category: 'aggregate' },
  { name: 'STDEV', signature: 'STDEV(expression)', description: 'Standard deviation', category: 'aggregate' },
  { name: 'VAR', signature: 'VAR(expression)', description: 'Variance', category: 'aggregate' },
  { name: 'CHECKSUM_AGG', signature: 'CHECKSUM_AGG(expression)', description: 'Checksum aggregate', category: 'aggregate' },

  // Window
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER (...)', description: 'Row number window function', category: 'window' },
  { name: 'RANK', signature: 'RANK() OVER (...)', description: 'Rank with gaps window function', category: 'window' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER (...)', description: 'Dense rank window function', category: 'window' },
  { name: 'NTILE', signature: 'NTILE(num_buckets) OVER (...)', description: 'Distribute rows into buckets', category: 'window' },
  { name: 'LAG', signature: 'LAG(value, offset, default) OVER (...)', description: 'Access previous row value', category: 'window' },
  { name: 'LEAD', signature: 'LEAD(value, offset, default) OVER (...)', description: 'Access next row value', category: 'window' },
  { name: 'FIRST_VALUE', signature: 'FIRST_VALUE(expr) OVER (...)', description: 'First value in window frame', category: 'window' },
  { name: 'LAST_VALUE', signature: 'LAST_VALUE(expr) OVER (...)', description: 'Last value in window frame', category: 'window' },
  { name: 'PERCENT_RANK', signature: 'PERCENT_RANK() OVER (...)', description: 'Relative rank as percentage', category: 'window' },
  { name: 'CUME_DIST', signature: 'CUME_DIST() OVER (...)', description: 'Cumulative distribution', category: 'window' },

  // Conditional
  { name: 'IIF', signature: 'IIF(condition, true_value, false_value)', description: 'Inline conditional', category: 'other' },
  { name: 'CHOOSE', signature: 'CHOOSE(index, val1, val2, ...)', description: 'Return value at index', category: 'other' },
  { name: 'ISNULL', signature: 'ISNULL(check_expression, replacement)', description: 'Replace NULL with value', category: 'other' },
  { name: 'ISNUMERIC', signature: 'ISNUMERIC(expression)', description: 'Check if numeric', category: 'other' },

  // JSON
  { name: 'JSON_VALUE', signature: "JSON_VALUE(json, '$.path')", description: 'Extract scalar value from JSON', category: 'json' },
  { name: 'JSON_QUERY', signature: "JSON_QUERY(json, '$.path')", description: 'Extract object/array from JSON', category: 'json' },
  { name: 'JSON_MODIFY', signature: "JSON_MODIFY(json, '$.path', newValue)", description: 'Modify value in JSON', category: 'json' },
  { name: 'ISJSON', signature: 'ISJSON(string)', description: 'Check if valid JSON', category: 'json' },
  { name: 'OPENJSON', signature: "OPENJSON(json, '$.path')", description: 'Parse JSON to rowset', category: 'json' },

  // System
  { name: 'SCOPE_IDENTITY', signature: 'SCOPE_IDENTITY()', description: 'Last identity value in current scope', category: 'other' },
  { name: 'OBJECT_ID', signature: "OBJECT_ID('object_name')", description: 'Get object ID by name', category: 'other' },
  { name: 'DB_NAME', signature: 'DB_NAME(database_id)', description: 'Get database name', category: 'other' },
  { name: 'SCHEMA_NAME', signature: 'SCHEMA_NAME(schema_id)', description: 'Get schema name', category: 'other' },
  { name: 'USER_NAME', signature: 'USER_NAME(user_id)', description: 'Get user name', category: 'other' },
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
    case DatabaseType.DuckDB:
      return [...commonFunctions, ...duckdbSpecificFunctions]
    case DatabaseType.SQLServer:
      return [...commonFunctions, ...sqlserverSpecificFunctions]
    default:
      return commonFunctions
  }
}
