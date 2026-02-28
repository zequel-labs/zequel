import { app } from 'electron'
import { existsSync, realpathSync } from 'fs'
import { resolve, normalize, sep } from 'path'

export const isPathAllowed = (filePath: string): boolean => {
  if (typeof filePath !== 'string' || !filePath) return false
  const resolved = resolve(normalize(filePath))
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
      const realPath = existsSync(resolved) ? realpathSync(resolved) : resolved
      return realPath.startsWith(realDir + sep)
    } catch {
      return resolved.startsWith(normalizedDir + sep)
    }
  })
}
