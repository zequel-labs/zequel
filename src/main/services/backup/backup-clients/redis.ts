import { writeSslTempFiles } from '../ssl-temp'
import { parseCustomArgs, formatDisplayCommand } from '../process-args'
import type { BackupClient, BackupClientContext } from '../models'
import { type BackupCommandSpec } from '@main/types'

/** Redis backup via redis-cli --rdb. */
export class RedisBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
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

    args.push('--no-auth-warning', '-h', host, '-p', String(port), '--rdb', config.outputPath)
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env, tempFiles,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { REDISCLI_AUTH: '********' } : {}),
    }
  }
}
