import { app } from 'electron'
import { existsSync, realpathSync } from 'fs'
import { resolve, normalize } from 'path'

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
    try {
      const realDir = realpathSync(dir)
      const realPath = existsSync(resolved) ? realpathSync(resolved) : resolved
      return realPath.startsWith(realDir + '/')
    } catch {
      return resolved.startsWith(dir + '/')
    }
  })
}
