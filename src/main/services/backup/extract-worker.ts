import { Worker } from 'node:worker_threads'

/** ZIP parsing and decompression run outside the main event loop and are terminable. */
export const extractArchive = async (input: string, directory: string, signal?: AbortSignal): Promise<void> => {
  signal?.throwIfAborted()
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const load = require('node:module').createRequire(workerData.modulePath);
    load('extract-zip')(workerData.input, { dir: workerData.directory })
      .then(() => parentPort.postMessage({ success: true }))
      .catch(error => parentPort.postMessage({ error: error.message }));
  `, { eval: true, workerData: { input, directory, modulePath: __filename } })
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = (): void => { void worker.terminate().then(() => reject(signal?.reason || new Error('Archive extraction cancelled'))) }
      signal?.addEventListener('abort', abort, { once: true })
      const clear = (): void => signal?.removeEventListener('abort', abort)
      worker.once('message', (result: { success?: boolean; error?: string }) => {
        clear()
        if (result.success) resolve()
        else reject(new Error(result.error || 'Archive extraction failed'))
      })
      worker.once('error', error => { clear(); reject(error) })
      worker.once('exit', () => { clear(); reject(new Error('Archive extraction stopped before completion')) })
      if (signal?.aborted) abort()
    })
  } finally { await worker.terminate() }
}
