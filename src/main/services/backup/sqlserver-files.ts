import { randomUUID } from 'node:crypto'
import type { DatabaseDriver } from '@main/db/base'

/** Ask the server for physical file locations; client filesystem paths are never used. */
export const resolveSqlServerRestoreFiles = async (driver: DatabaseDriver, backupPath: string, database: string, replace: boolean): Promise<string> => {
  const files = await driver.execute(`RESTORE FILELISTONLY FROM DISK = N'${backupPath.replace(/'/g, "''")}'`)
  if (files.error) throw new Error(files.error)
  if (!files.rows.length) throw new Error('The server could not read the backup file list')
  const paths = await driver.execute("SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS dataPath, CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000)) AS logPath")
  if (paths.error) throw new Error(paths.error)
  const existing = await driver.execute('SELECT file_id, physical_name FROM sys.master_files WHERE database_id = DB_ID(?)', [database])
  if (existing.error) throw new Error(existing.error)
  if (existing.rows.length && !replace) throw new Error('The destination database already exists. Enable Replace existing database to restore into it.')
  const prefix = `zequel-${randomUUID()}`
  return JSON.stringify(files.rows.map(file => {
    const type = String(file.Type)
    if (type !== 'D' && type !== 'L') throw new Error('This backup contains a file type requiring a custom SQL Server restore plan')
    const directory = paths.rows[0]?.[type === 'L' ? 'logPath' : 'dataPath']
    if (typeof directory !== 'string' || !directory) throw new Error('The server did not provide a default database file directory')
    const previous = existing.rows.find(item => String(item.file_id) === String(file.FileId))
    const physical = previous?.physical_name || `${directory}${directory.endsWith('/') || directory.endsWith('\\') ? '' : directory.includes('\\') ? '\\' : '/'}${prefix}-${file.FileId}.${type === 'L' ? 'ldf' : 'mdf'}`
    return { logical: String(file.LogicalName), path: String(physical) }
  }))
}
