import { appendMongoTlsArgs } from '@main/services/backup/ssl-temp'
import { parseCustomArgs, formatDisplayCommand, maskFlagValue } from '@main/services/backup/process-args'
import type { RestoreClient, RestoreClientContext } from '@main/services/backup/models'
import { type BackupCommandSpec } from '@main/types'

/** MongoDB restore via mongorestore (directory or --archive). */
export class MongoRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB restore. Please check your connection settings.')
    }

    const env: Record<string, string> = {}
    const tempFiles: string[] = []
    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    if (password) args.push('--password', password)
    // Match the driver, which authenticates against `admin` for credentialed connections.
    if (conn.username && conn.database && conn.database !== 'admin') {
      args.push('--authenticationDatabase', 'admin')
    }

    // SSL: mongorestore uses the same TLS flags as mongodump
    await appendMongoTlsArgs(args, tempFiles, conn.ssl, conn.sslConfig)

    args.push('--db', conn.database)

    if (config.isDirectory) {
      args.push(config.inputPath)
    } else {
      args.push(`--archive=${config.inputPath}`)
    }

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    const displayArgs = maskFlagValue(args, '--password')

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }
}
