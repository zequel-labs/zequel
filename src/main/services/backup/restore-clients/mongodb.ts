import { writeFile } from 'fs/promises'
import { writeSslTempFiles } from '../ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { RestoreClient, RestoreClientContext } from '../models'
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
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        if (conn.sslConfig.rejectUnauthorized === false) args.push('--tlsInsecure')
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push(`--tlsCAFile=${ssl.ca}`); tempFiles.push(ssl.ca) }
        // MongoDB --tlsCertificateKeyFile expects a single PEM with both cert and key
        if (ssl.cert && ssl.key) {
          await writeFile(ssl.cert, conn.sslConfig.cert + '\n' + conn.sslConfig.key, { mode: 0o600 })
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert, ssl.key)
        } else if (ssl.cert) {
          args.push(`--tlsCertificateKeyFile=${ssl.cert}`)
          tempFiles.push(ssl.cert)
        } else if (ssl.key) {
          args.push(`--tlsCertificateKeyFile=${ssl.key}`)
          tempFiles.push(ssl.key)
        }
      }
    }

    args.push('--db', conn.database)

    if (config.isDirectory) {
      args.push(config.inputPath)
    } else {
      args.push(`--archive=${config.inputPath}`)
    }

    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}),
    }
  }
}
