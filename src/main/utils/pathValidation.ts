import { app } from 'electron'
import { existsSync, realpathSync } from 'fs'
import { resolve, normalize, sep, dirname, basename } from 'path'

const selectedPaths = new Set<string>()
const canonicalPath = (path: string): string => existsSync(path)
  ? realpathSync(path) : resolve(realpathSync(dirname(path)), basename(path))

/** Native file dialogs grant access to the exact selected file, including external drives. */
export const allowSelectedPath = (path: string): void => {
  selectedPaths.add(canonicalPath(resolve(path)))
}

export const isPathAllowed = (filePath: string): boolean => {
  if (typeof filePath !== 'string' || !filePath) return false
  const resolved = resolve(normalize(filePath))
  try {
    if (selectedPaths.has(canonicalPath(resolved))) return true
  } catch { /* Continue with the standard application directories. */ }
  const allowedDirs = [
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('temp'),
  ]
  return allowedDirs.some(dir => {
    const normalizedDir = resolve(normalize(dir))
    try {
      const realDir = realpathSync(normalizedDir)
      const realPath = existsSync(resolved) ? realpathSync(resolved) : resolve(realpathSync(dirname(resolved)), basename(resolved))
      return realPath.startsWith(realDir + sep)
    } catch {
      return resolved.startsWith(normalizedDir + sep)
    }
  })
}
