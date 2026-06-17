import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { parseCustomArgs, formatDisplayCommand } from '@main/services/backup/process-args'
import type { RestoreClient, RestoreClientContext } from '@main/services/backup/models'
import { DatabaseType, DEFAULT_PORTS, type BackupCommandSpec } from '@main/types'

/** ClickHouse restore via clickhouse-client --multiquery (SQL piped over stdin). */
export class ClickHouseRestoreClient implements RestoreClient {
  async buildRestoreSpec(ctx: RestoreClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for ClickHouse restore. Please check your connection settings.')
    }

    if (sshTunnelManager.hasTunnel(config.connectionId)) {
      throw new Error('ClickHouse restore through SSH tunnels is not supported. The CLI requires native TCP port 9000, but SSH tunnels are configured for HTTP port 8123. Please use a direct connection.')
    }

    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    const env: Record<string, string> = {}
    if (conn.username) args.push('--user', conn.username)
    if (password) env['CLICKHOUSE_PASSWORD'] = password
    if (conn.ssl) args.push('--secure')
    args.push('--database', conn.database, '--multiquery')
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { CLICKHOUSE_PASSWORD: '********' } : {}) + ` < "${config.inputPath}"`,
    }
  }
}
