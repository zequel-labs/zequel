import { link, lstat, mkdir, mkdtemp, rename, rm, rmdir, unlink } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

/**
 * Only the private staging directory belongs to the operation. Never remove a
 * user-selected destination during cleanup, including on validation/spawn failure.
 */
export interface BackupArtifact {
  path: string
  publish: (path: string, destination?: string) => Promise<string>
  cleanup: () => Promise<void>
}

const destinations = new Set<string>()

const assertAbsent = async (path: string): Promise<void> => {
  try {
    await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  throw new Error(`Destination already exists. Choose a new path: ${path}`)
}

export const createBackupArtifact = async (destination: string): Promise<BackupArtifact> => {
  destination = resolve(destination)
  if (destinations.has(destination)) throw new Error('Another transfer is writing to this destination')
  destinations.add(destination)
  let directory: string
  try {
    await assertAbsent(destination)
    directory = await mkdtemp(join(dirname(destination), '.zequel-backup-'))
  } catch (error) {
    destinations.delete(destination)
    throw error
  }
  return {
    path: join(directory, basename(destination)),
    publish: async (path: string, finalDestination: string = destination): Promise<string> => {
      if ((await lstat(path)).isDirectory()) {
        if (process.platform === 'win32') {
          // Windows refuses to rename a directory over any existing destination.
          // Reserving an empty directory first would make every publication fail.
          await rename(path, finalDestination)
        } else {
          // POSIX rename can replace an empty directory; reserve it exclusively.
          await mkdir(finalDestination)
          try {
            await rename(path, finalDestination)
          } catch (error) {
            await rmdir(finalDestination).catch(() => {})
            throw error
          }
        }
      } else {
        // Same filesystem staging allows exclusive publication without the
        // check-then-rename race that overwrites an existing file.
        await link(path, finalDestination)
        await unlink(path)
      }
      return finalDestination
    },
    cleanup: async (): Promise<void> => {
      try {
        await rm(directory, { recursive: true, force: true })
      } finally {
        destinations.delete(destination)
      }
    },
  }
}
