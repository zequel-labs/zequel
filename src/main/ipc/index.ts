import { registerConnectionHandlers } from './connection'
import { registerQueryHandlers } from './query'
import { registerSchemaHandlers } from './schema'
import { registerSchemaEditHandlers } from './schema-edit'
import { registerHistoryHandlers } from './history'
import { registerExportHandlers } from './export'
import { registerMonitoringHandlers } from './monitoring'
import { registerPostgreSQLHandlers } from './postgresql'
import { registerRecentsHandlers } from './recents'

export function registerAllHandlers(): void {
  registerConnectionHandlers()
  registerQueryHandlers()
  registerSchemaHandlers()
  registerSchemaEditHandlers()
  registerHistoryHandlers()
  registerExportHandlers()
  registerMonitoringHandlers()
  registerPostgreSQLHandlers()
  registerRecentsHandlers()
}
