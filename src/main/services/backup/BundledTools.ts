import { app } from 'electron'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { BackupBinaryInfo } from '@main/types'

interface Toolchain {
  engine: string
  version: string
  binaries: Record<string, string>
}
interface ToolManifest {
  platform: string
  arch: string
  tools: Toolchain[]
}

const bundledRoot = (): string => join(
  app.isPackaged ? join(process.resourcesPath, 'resources') : join(process.cwd(), 'resources'),
  'database-tools', `${process.platform}-${process.arch}`,
)

/** A missing packaged tool is an installation error, never an invitation to search PATH. */
export const findBundledTool = (engine: string, binary: string): BackupBinaryInfo | null => {
  const root = bundledRoot()
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) return null
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ToolManifest
    if (manifest.platform !== process.platform || manifest.arch !== process.arch || !Array.isArray(manifest.tools)) throw new Error('Wrong platform')
    const tool = manifest.tools.find(tool => tool.engine === engine && typeof tool.binaries?.[binary] === 'string')
    if (!tool || typeof tool.version !== 'string') return null
    const path = resolve(root, tool.binaries[binary])
    const local = relative(realpathSync(root), realpathSync(path))
    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Tool path escapes bundle')
    return { path, found: true, version: tool.version, warning: null }
  } catch {
    return { path: null, found: false, version: null, warning: 'The bundled database tools are damaged. Repair or update Zequel.' }
  }
}
