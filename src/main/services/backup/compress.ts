import archiver from 'archiver'
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { once } from 'node:events'
import { finished, pipeline } from 'node:stream/promises'

/** Own every file handle so cancellation can finish cleanup on Windows too. */
export const compressBackup = async (
  source: string, destination: string, signal?: AbortSignal, onProgress?: (bytes: number) => void,
): Promise<void> => {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const abort = (): void => { controller.abort(signal?.reason) }
  signal?.addEventListener('abort', abort, { once: true })
  const archive = archiver('zip', { zlib: { level: 6 } })
  const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 })
  const writing = pipeline(archive, output, { signal: controller.signal })
  // Handle immediately: an output error can occur while enumerating the input.
  const written = writing.catch(error => { controller.abort(error) })
  let input: ReadStream | undefined
  let bytes = 0
  const append = async (path: string, name: string): Promise<void> => {
    controller.signal.throwIfAborted()
    const info = await lstat(path)
    controller.signal.throwIfAborted()
    if (info.isDirectory()) {
      const entries = await readdir(path)
      if (!entries.length && name) {
        const entry = once(archive, 'entry', { signal: controller.signal })
        archive.append(Buffer.alloc(0), { name: name + '/' })
        await entry
      }
      for (const child of entries) await append(join(path, child), name ? `${name}/${child}` : child)
      return
    }
    if (!info.isFile()) throw new Error(`Unsupported backup entry: ${path}`)
    input = createReadStream(path, { signal: controller.signal })
    input.on('data', chunk => { bytes += Buffer.byteLength(chunk); onProgress?.(bytes) })
    input.on('error', error => archive.destroy(error))
    const closed = finished(input)
    const entry = once(archive, 'entry', { signal: controller.signal })
    archive.append(input, { name })
    try { await Promise.all([entry, closed]) }
    finally {
      input.destroy()
      await closed.catch(() => {})
      input = undefined
    }
  }
  try {
    const root = await lstat(source)
    await append(source, root.isDirectory() ? '' : basename(source).replace(/\.zip$/i, '.dump'))
    await Promise.race([archive.finalize(), writing])
    await writing
  } finally {
    signal?.removeEventListener('abort', abort)
    input?.destroy()
    archive.abort()
    archive.destroy()
    output.destroy()
    await written
    await finished(output).catch(() => {})
  }
  signal?.throwIfAborted()
}
