import { extractArchive } from '@main/services/backup/extract-worker'
import { mkdtemp, rm, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/** File extensions recognized as restorable database dumps inside ZIP archives. */
export const KNOWN_RESTORE_EXTENSIONS = ['.sql', '.dump', '.tar', '.bson', '.rdb', '.bak', '.jsonl', '.archive']

/**
 * If the input path is a .zip file, extract it to a temp directory and return
 * the path to the first SQL/dump file inside. Returns the original path unchanged
 * for non-zip files. The caller must clean up `tempDir` when done.
 */
export const decompressIfZip = async (
  inputPath: string,
  databaseType?: string,
  signal?: AbortSignal,
): Promise<{ resolvedPath: string; tempDir: string | null }> => {
  if (!inputPath.toLowerCase().endsWith('.zip')) {
    return { resolvedPath: inputPath, tempDir: null }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'zequel-restore-'))
  try {
    await extractArchive(inputPath, tempDir, signal)
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  const files = await readdir(tempDir)
  if (files.includes('toc.dat') || (databaseType === 'mongodb' && files.some(name => name.endsWith('.bson') || name.endsWith('.metadata.json')))) {
    return { resolvedPath: tempDir, tempDir }
  }
  const candidates = files.filter(name => KNOWN_RESTORE_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension)))
  if (candidates.length === 1) return { resolvedPath: join(tempDir, candidates[0]), tempDir }
  if (files.length === 1) return { resolvedPath: join(tempDir, files[0]), tempDir }
  await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  throw new Error(candidates.length > 1 ? 'The ZIP contains multiple possible restore inputs. Choose the backup file explicitly.' : 'No SQL or dump file found inside the ZIP archive.')

}
