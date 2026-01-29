import { registerConnectionHandlers } from './connection'
import { registerQueryHandlers } from './query'
import { registerSchemaHandlers } from './schema'
import { registerHistoryHandlers } from './history'

export function registerAllHandlers(): void {
  registerConnectionHandlers()
  registerQueryHandlers()
  registerSchemaHandlers()
  registerHistoryHandlers()
}
