import { writeFile } from 'fs/promises'
import { writeSslTempFiles } from '../ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { BackupClient, BackupClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** MongoDB backup via mongodump. */
export class MongoBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for MongoDB backup. Please check your connection settings.')
    }

    const env: Record<string, string> = {}
    const tempFiles: string[] = []
    const args: string[] = ['--host', host, '--port', String(port)]
    if (conn.username) args.push('--username', conn.username)
    // mongodump has no env var for password — use --password (inherent CLI limitation)
    if (password) args.push('--password', password)
    // Match the driver, which authenticates against `admin` for credentialed connections.
    if (conn.username && conn.database && conn.database !== 'admin') {
      args.push('--authenticationDatabase', 'admin')
    }

    // SSL: mongodump uses --tls and cert file flags
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        if (conn.sslConfig.rejectUnauthorized === false) args.push('--tlsInsecure')
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push(`--tlsCAFile=${ssl.ca}`); tempFiles.push(ssl.ca) }
        // MongoDB --tlsCertificateKeyFile expects a single PEM with both cert and key
        if (ssl.cert && ssl.key) {
          // Append key content to the cert file so MongoDB gets both in one file
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

    args.push('--db', conn.database, `--out=${config.outputPath}`)
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    // mongodump backs up one collection per invocation (`-c`). With no collection selected
    // it dumps the whole database. For several selected collections we run mongodump once
    // per collection into the same `--out` directory (via extraCommands) — capturing
    // exactly the chosen collections instead of silently widening to the whole database.
    let extraCommands: { binary: string; args: string[]; env: Record<string, string> }[] | undefined
    if (config.entities.length >= 1) {
      args.push('--collection', config.entities[0].name)
      if (config.entities.length > 1) {
        extraCommands = config.entities.slice(1).map(entity => ({
          binary: config.binaryPath,
          // Same args with only the trailing collection name swapped.
          args: [...args.slice(0, -1), entity.name],
          env,
        }))
      }
    }

    const displayArgs = args.map((a, i) => args[i - 1] === '--password' ? '********' : a)
    const extraNote = extraCommands?.length ? ` (+${extraCommands.length} more collection${extraCommands.length > 1 ? 's' : ''})` : ''

    return {
      binary: config.binaryPath, args, env, tempFiles, extraCommands,
      displayCommand: formatDisplayCommand(config.binaryPath, displayArgs, {}) + extraNote,
    }
  }
}
