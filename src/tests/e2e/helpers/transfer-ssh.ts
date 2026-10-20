import { Server, type Connection } from 'ssh2'
import { connect } from 'node:net'
import { generateKeyPairSync } from 'node:crypto'

/** A disposable tunnel endpoint that can only forward to one local fixture. */
export const createTransferSshServer = async (port: number): Promise<{ server: Server; port: number; activeConnections: () => number; close: () => Promise<void> }> => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const clients = new Set<Connection>()
  const server = new Server({ hostKeys: [privateKey] }, client => {
    clients.add(client)
    client.once('close', () => clients.delete(client))
    client.on('authentication', context => {
      if (context.method === 'password' && context.username === 'transfer' && context.password === 'isolated-test') context.accept()
      else context.reject()
    })
    // ssh2 implements setNoDelay on server connections but omits it from its typings.
    client.on('ready', () => (client as Connection & { setNoDelay: (noDelay: boolean) => void }).setNoDelay(true))
    client.on('ready', () => client.on('tcpip', (accept, reject, info) => {
      if (info.destIP !== 'localhost' || info.destPort !== port) { reject(); return }
      let accepted = false
      const socket = connect({ host: '127.0.0.1', port }, () => {
        accepted = true
        // Like OpenSSH, forward request/response traffic without Nagle delays.
        socket.setNoDelay(true)
        const channel = accept()
        channel.pipe(socket).pipe(channel)
        channel.on('error', () => socket.destroy())
        channel.on('close', () => socket.destroy())
      })
      socket.on('error', () => { socket.destroy(); if (!accepted) reject() })
    }))
    client.on('error', () => {})
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('SSH server did not start')
  return {
    server, port: address.port, activeConnections: () => clients.size,
    close: async () => {
      for (const client of clients) client.end()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}
