import { writeSslTempFiles } from '@main/services/backup/ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '@main/services/backup/process-args'
import type { RestoreClient, RestoreClientContext } from '@main/services/backup/models'
import { type BackupCommandSpec } from '@main/types'

/** Redis restore via redis-cli --pipe (Redis protocol commands over stdin). */
export class RedisRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    // redis-cli --pipe reads Redis inline/RESP protocol commands from stdin.
    // Note: RDB files (produced by --rdb backup) cannot be restored via --pipe.
    // RDB restore requires placing the file on the server as dump.rdb and restarting Redis.
    // --pipe mode is for Redis protocol command files (e.g., SET key value\r\n).
    const args: string[] = []
    const tempFiles: string[] = []
    const env: Record<string, string> = {}
    if (password) env['REDISCLI_AUTH'] = password

    // SSL: redis-cli uses --tls and cert file flags
    if (conn.ssl) {
      args.push('--tls')
      if (conn.sslConfig) {
        const ssl = await writeSslTempFiles(conn.sslConfig)
        if (ssl.ca) { args.push('--cacert', ssl.ca); tempFiles.push(ssl.ca) }
        if (ssl.cert) { args.push('--cert', ssl.cert); tempFiles.push(ssl.cert) }
        if (ssl.key) { args.push('--key', ssl.key); tempFiles.push(ssl.key) }
      }
    }

    args.push('--no-auth-warning', '-h', host, '-p', String(port), '--pipe')
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }
}
