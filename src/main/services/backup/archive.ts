import extract from 'extract-zip'
import { mkdtemp, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/** File extensions recognized as restorable database dumps inside ZIP archives. */
export const KNOWN_RESTORE_EXTENSIONS = ['.sql', '.dump', '.bson', '.rdb', '.bak']

/**
 * If the input path is a .zip file, extract it to a temp directory and return
 * the path to the first SQL/dump file inside. Returns the original path unchanged
 * for non-zip files. The caller must clean up `tempDir` when done.
 */
export const decompressIfZip = async (
  inputPath: string
): Promise<{ resolvedPath: string; tempDir: string | null }> => {
  if (!inputPath.toLowerCase().endsWith('.zip')) {
    return { resolvedPath: inputPath, tempDir: null }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'zequel-restore-'))
  try {
    await extract(inputPath, { dir: tempDir })
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  const files = await readdir(tempDir)
  const lower = (name: string): string => name.toLowerCase()
  const sqlFile = files.find(f =>
    KNOWN_RESTORE_EXTENSIONS.some(ext => lower(f).endsWith(ext))
  )

  if (!sqlFile) {
    // Single-file zips from our own backup process
    if (files.length === 1) {
      return { resolvedPath: join(tempDir, files[0]), tempDir }
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw new Error('No SQL or dump file found inside the ZIP archive.')
  }

  return { resolvedPath: join(tempDir, sqlFile), tempDir }
}
