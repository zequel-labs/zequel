import { registerConnectionHandlers } from './connection'
import { registerQueryHandlers } from './query'
import { registerSchemaHandlers } from './schema'
import { registerSchemaEditHandlers } from './schema-edit'
import { registerHistoryHandlers } from './history'
import { registerExportHandlers } from './export'

export function registerAllHandlers(): void {
  registerConnectionHandlers()
  registerQueryHandlers()
  registerSchemaHandlers()
  registerSchemaEditHandlers()
  registerHistoryHandlers()
  registerExportHandlers()
}
