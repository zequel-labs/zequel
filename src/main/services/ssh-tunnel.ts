import { Client, ConnectConfig } from 'ssh2'
import * as net from 'net'
import { logger } from '../utils/logger'
import type { SSHConfig } from '../types'

interface TunnelInfo {
  client: Client
  server: net.Server
  localPort: number
}

class SSHTunnelManager {
  private tunnels: Map<string, TunnelInfo> = new Map()

  /**
   * Create an SSH tunnel to the database server
   * Returns the local port to connect to
   */
  async createTunnel(
    connectionId: string,
    sshConfig: SSHConfig,
    remoteHost: string,
    remotePort: number
  ): Promise<number> {
    // Check if tunnel already exists
    if (this.tunnels.has(connectionId)) {
      const existing = this.tunnels.get(connectionId)!
      return existing.localPort
    }

    return new Promise((resolve, reject) => {
      const client = new Client()

      // Find an available local port
      const server = net.createServer((socket) => {
        client.forwardOut(
          '127.0.0.1',
          socket.localPort || 0,
          remoteHost,
          remotePort,
          (err, stream) => {
            if (err) {
              logger.error('SSH forward error:', err)
              socket.end()
              return
            }
            socket.pipe(stream)
            stream.pipe(socket)
          }
        )
      })

      server.on('error', (err) => {
        logger.error('SSH tunnel server error:', err)
        this.closeTunnel(connectionId)
        reject(err)
      })

      // Listen on random available port
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as net.AddressInfo
        const localPort = address.port
        logger.info(`SSH tunnel created: localhost:${localPort} -> ${remoteHost}:${remotePort}`)

        this.tunnels.set(connectionId, {
          client,
          server,
          localPort
        })

        resolve(localPort)
      })

      // Build SSH connection config
      const connectConfig: ConnectConfig = {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        readyTimeout: 30000
      }

      if (sshConfig.authMethod === 'password') {
        connectConfig.password = sshConfig.password
      } else if (sshConfig.authMethod === 'privateKey') {
        connectConfig.privateKey = sshConfig.privateKey
        if (sshConfig.privateKeyPassphrase) {
          connectConfig.passphrase = sshConfig.privateKeyPassphrase
        }
      }

      client.on('ready', () => {
        logger.info('SSH connection established')
      })

      client.on('error', (err) => {
        logger.error('SSH connection error:', err)
        this.closeTunnel(connectionId)
        reject(err)
      })

      client.on('close', () => {
        logger.info('SSH connection closed')
        this.closeTunnel(connectionId)
      })

      client.connect(connectConfig)
    })
  }

  /**
   * Close an existing SSH tunnel
   */
  closeTunnel(connectionId: string): void {
    const tunnel = this.tunnels.get(connectionId)
    if (tunnel) {
      tunnel.server.close()
      tunnel.client.end()
      this.tunnels.delete(connectionId)
      logger.info(`SSH tunnel closed for connection: ${connectionId}`)
    }
  }

  /**
   * Check if a tunnel exists for a connection
   */
  hasTunnel(connectionId: string): boolean {
    return this.tunnels.has(connectionId)
  }

  /**
   * Get the local port for an existing tunnel
   */
  getLocalPort(connectionId: string): number | null {
    const tunnel = this.tunnels.get(connectionId)
    return tunnel ? tunnel.localPort : null
  }

  /**
   * Close all tunnels
   */
  closeAllTunnels(): void {
    for (const connectionId of this.tunnels.keys()) {
      this.closeTunnel(connectionId)
    }
  }
}

export const sshTunnelManager = new SSHTunnelManager()
