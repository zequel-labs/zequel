import { createServer, type TLSSocket } from 'node:tls'
import { connect } from 'node:net'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/** TLS endpoint for the disposable Redis, MongoDB and HTTP ClickHouse fixtures. */
export const createTransferTlsServer = async (targetPort: number): Promise<{ port: number; ca: string; wrongCA: string; close: () => Promise<void> }> => {
  const directory = await mkdtemp(join(tmpdir(), 'zequel-test-tls-'))
  const key = join(directory, 'key.pem')
  const certificate = join(directory, 'cert.pem')
  const wrong = join(directory, 'wrong.pem')
  const sockets = new Set<TLSSocket>()
  try {
    for (const [cert, name] of [[certificate, 'localhost'], [wrong, 'unrelated.invalid']]) {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${name}`,
        '-addext', `subjectAltName=DNS:${name}${name === 'localhost' ? ',IP:127.0.0.1' : ''}`,
        '-keyout', cert === certificate ? key : join(directory, 'wrong-key.pem'), '-out', cert], { stdio: 'ignore' })
    }
    const ca = await readFile(certificate, 'utf8')
    const server = createServer({ cert: ca, key: await readFile(key, 'utf8') }, socket => {
      sockets.add(socket)
      const upstream = connect({ host: '127.0.0.1', port: targetPort }, () => socket.pipe(upstream).pipe(socket))
      upstream.on('error', () => socket.destroy())
      socket.on('error', () => upstream.destroy())
      socket.once('close', () => { sockets.delete(socket); upstream.destroy() })
    })
    server.on('tlsClientError', () => {})
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('TLS fixture did not start')
    return { port: address.port, ca, wrongCA: await readFile(wrong, 'utf8'), close: async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>(resolve => server.close(() => resolve()))
      await rm(directory, { recursive: true, force: true })
    } }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
