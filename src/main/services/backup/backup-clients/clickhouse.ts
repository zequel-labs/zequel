import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { parseCustomArgs, formatDisplayCommand } from '@main/services/backup/process-args'
import type { BackupClient, BackupClientContext } from '@main/services/backup/models'
import { DatabaseType, DEFAULT_PORTS, type BackupCommandSpec } from '@main/types'

/** ClickHouse backup via clickhouse-client (DDL + data as SQL). */
export class ClickHouseBackupClient implements BackupClient {
  async buildBackupSpec(ctx: BackupClientContext): Promise<BackupCommandSpec> {
    const { config, conn, password, host, port } = ctx
    if (!conn.database) {
      throw new Error('Database name is required for ClickHouse backup. Please check your connection settings.')
    }

    // ClickHouse CLI uses native TCP port (default 9000), not HTTP port (8123).
    // SSH tunnels map to the HTTP port, so CLI operations through them won't work.
    if (sshTunnelManager.hasTunnel(config.connectionId)) {
      throw new Error('ClickHouse backup through SSH tunnels is not supported. The CLI requires native TCP port 9000, but SSH tunnels are configured for HTTP port 8123. Please use a direct connection.')
    }

    const tables = config.entities.map(e => e.name)
    // Escape backticks in table names by doubling them (ClickHouse standard)
    const quoteIdent = (name: string): string => '`' + name.replace(/`/g, '``') + '`'
    // Escape single quotes for string literals in WHERE clauses
    const quoteLiteral = (name: string): string => "'" + name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

    // Build restorable SQL backup:
    //   DDL: query system.tables for CREATE TABLE + append semicolon (TabSeparatedRaw = raw text)
    //   Data: FORMAT SQLInsert produces INSERT INTO ... VALUES (...) statements
    // The output is a valid multi-statement SQL file restorable via clickhouse-client --multiquery.
    let query: string
    if (tables.length > 0) {
      const parts: string[] = []
      for (const t of tables) {
        parts.push(`SELECT concat(create_table_query, ';\\n') FROM system.tables WHERE database = currentDatabase() AND name = ${quoteLiteral(t)} FORMAT TabSeparatedRaw`)
        parts.push(`SELECT * FROM ${quoteIdent(t)} FORMAT SQLInsert`)
      }
      query = parts.join(';\n')
    } else {
      // Full database dump: export DDL for all non-system tables, then data for each.
      // We use two queries separated by semicolons:
      //   1) DDL from system.tables
      //   2) Data via a single INSERT SELECT for all tables (clickhouse streams this)
      // Note: We cannot dynamically iterate tables in a single --query, so we dump
      // DDL first. Data for individual tables requires per-table queries, which
      // we cannot generate without knowing table names. To keep it simple and
      // correct, the full-dump path exports DDL only. Users should select specific
      // tables for a data-inclusive backup, or use clickhouse-backup tool for full dumps.
      query = `SELECT concat(create_table_query, ';\\n') FROM system.tables WHERE database = currentDatabase() AND engine NOT IN ('SystemLog') FORMAT TabSeparatedRaw`
    }

    const cliPort = port === DEFAULT_PORTS[DatabaseType.ClickHouse] ? 9000 : port
    const args: string[] = ['--host', host, '--port', String(cliPort)]
    const env: Record<string, string> = {}
    if (conn.username) args.push('--user', conn.username)
    if (password) env['CLICKHOUSE_PASSWORD'] = password
    // SSL: clickhouse-client uses --secure for TLS connections
    if (conn.ssl) args.push('--secure')
    args.push('--database', conn.database, '--multiquery', '--query', query)
    if (config.customArgs) args.push(...parseCustomArgs(config.customArgs))

    return {
      binary: config.binaryPath, args, env,
      displayCommand: formatDisplayCommand(config.binaryPath, args, password ? { CLICKHOUSE_PASSWORD: '********' } : {}) + ` > "${config.outputPath}"`,
    }
  }
}
