import { registerAppHandlers } from './app'
import { registerConnectionHandlers } from './connection'
import { registerQueryHandlers } from './query'
import { registerSchemaHandlers } from './schema'
import { registerSchemaEditHandlers } from './schema-edit'
import { registerHistoryHandlers } from './history'
import { registerExportHandlers } from './export'
import { registerImportHandlers } from './import'
import { registerMonitoringHandlers } from './monitoring'
import { registerPostgreSQLHandlers } from './postgresql'
import { registerRecentsHandlers } from './recents'
import { registerPinnedHandlers } from './pinned'
import { registerUpdaterHandlers } from './updater'
import { registerStreamHandlers } from './stream'
import { registerTransactionHandlers } from './transaction'
import { registerTransferHandlers } from '@main/ipc/transfers'

export const registerAllHandlers = (): void => {
  registerAppHandlers()
  registerConnectionHandlers()
  registerQueryHandlers()
  registerSchemaHandlers()
  registerSchemaEditHandlers()
  registerHistoryHandlers()
  registerExportHandlers()
  registerImportHandlers()
  registerMonitoringHandlers()
  registerPostgreSQLHandlers()
  registerRecentsHandlers()
  registerPinnedHandlers()
  registerUpdaterHandlers()
  registerStreamHandlers()
  registerTransactionHandlers()
  registerTransferHandlers()
}
