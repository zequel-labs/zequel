import { isAbsolute, win32 } from 'node:path'
import { DatabaseType, type TransferRequest } from '@main/types'

export const validateTransferRequest = (type: DatabaseType, request: TransferRequest): void => {
  if (!Object.values(DatabaseType).includes(type)) throw new Error('This database engine does not support transfers')
  const options = request.options
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid transfer options')
  const allowed = new Set(type === DatabaseType.PostgreSQL
    ? ['format', 'no-owner', 'no-privileges', 'single-transaction', 'jobs', 'compression']
    : type === DatabaseType.MongoDB ? ['archive', 'sourceDatabase', 'drop'] : ['replace'])
  for (const [name, value] of Object.entries(options)) {
    if (!allowed.has(name)) throw new Error(`Unsupported option: ${name}`)
    if (['no-owner', 'no-privileges', 'single-transaction', 'archive', 'drop', 'replace'].includes(name) && typeof value !== 'boolean') throw new Error(`Invalid option: ${name}`)
  }
  if (type === DatabaseType.PostgreSQL) {
    if (options.format !== undefined && !['plain', 'custom', 'directory'].includes(String(options.format))) throw new Error('Unsupported PostgreSQL backup format')
    if (options.jobs !== undefined && (!Number.isSafeInteger(options.jobs) || Number(options.jobs) < 1)) throw new Error('Jobs must be a positive integer')
    if (options.compression !== undefined && (!Number.isInteger(options.compression) || Number(options.compression) < 0 || Number(options.compression) > 9)) throw new Error('Compression must be between 0 and 9')
    if (Number(options.jobs) > 1 && (options['single-transaction'] || (request.mode === 'backup' && options.format !== 'directory'))) throw new Error('Parallel jobs require a directory backup and cannot use a single restore transaction')
  }
  if (type === DatabaseType.SQLServer) {
    if (!isAbsolute(request.path) && !win32.isAbsolute(request.path)) throw new Error('Enter an absolute path on the database server')
    if (request.compress) throw new Error('SQL Server backup files are stored on the server and cannot be zipped locally')
  }
  if (type === DatabaseType.MongoDB && request.mode === 'restore') {
    if (typeof options.sourceDatabase !== 'string' || !options.sourceDatabase.trim()) throw new Error('Enter the database name inside the MongoDB backup')
    if (/[*$\\]/.test(options.sourceDatabase) || /[*$\\]/.test(request.database)) throw new Error('Namespace patterns are not allowed in database names')
  }
  if (request.database.includes('\0') || request.path.includes('\0')) throw new Error('Database names and paths cannot contain null bytes')
}
