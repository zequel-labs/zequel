import { parse } from 'csv-parse/browser/esm/sync'

/** Keep cell text intact: an empty string and the word NULL are not SQL NULL. */
export const parseClipboardRows = (
  text: string,
  writableColumns: string[],
): Record<string, unknown>[] => {
  if (!text.trim()) throw new Error('Clipboard is empty')
  const firstLine = text.split(/\r?\n/, 1)[0]
  const records = parse(text, {
    bom: true,
    delimiter: firstLine.includes('\t') ? '\t' : ',',
    skip_empty_lines: true,
  }) as string[][]
  if (records.length < 2) throw new Error('Include a header row and at least one data row')
  const [headers, ...rows] = records
  if (new Set(headers).size !== headers.length) throw new Error('Clipboard contains duplicate column names')
  const indices = headers.flatMap((name, index) => writableColumns.includes(name) ? [index] : [])
  if (!indices.length) throw new Error('No matching writable columns found in clipboard data')
  return rows.map(values => Object.fromEntries(indices.map(index => [headers[index], values[index]])))
}
