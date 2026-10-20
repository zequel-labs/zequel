import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBackupArtifact } from '@main/services/backup/artifacts'

const directories: string[] = []
const fixture = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'zequel-artifact-test-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('backup artifact ownership', () => {
  it('preserves an existing file before the operation starts', async () => {
    const destination = join(await fixture(), 'existing.sql')
    await writeFile(destination, 'irreplaceable backup')
    await expect(createBackupArtifact(destination)).rejects.toThrow('already exists')
    expect(await readFile(destination, 'utf8')).toBe('irreplaceable backup')
  })

  it('cleans only staging after a failed operation', async () => {
    const directory = await fixture()
    const destination = join(directory, 'backup.sql')
    const artifact = await createBackupArtifact(destination)
    await writeFile(artifact.path, 'partial')
    await writeFile(join(directory, 'unrelated.sql'), 'keep')
    await artifact.cleanup()
    expect(await readdir(directory)).toEqual(['unrelated.sql'])
  })

  it('does not overwrite a destination created while backup is running', async () => {
    const destination = join(await fixture(), 'backup.sql')
    const artifact = await createBackupArtifact(destination)
    await writeFile(artifact.path, 'new backup')
    await writeFile(destination, 'other writer')
    await expect(artifact.publish(artifact.path)).rejects.toThrow()
    await artifact.cleanup()
    expect(await readFile(destination, 'utf8')).toBe('other writer')
  })

  it('publishes complete files and releases the reservation', async () => {
    const destination = join(await fixture(), 'backup.sql')
    const artifact = await createBackupArtifact(destination)
    await expect(createBackupArtifact(destination)).rejects.toThrow('Another backup')
    await writeFile(artifact.path, 'complete')
    expect(await artifact.publish(artifact.path)).toBe(destination)
    await artifact.cleanup()
    expect(await readFile(destination, 'utf8')).toBe('complete')
  })

  it('preserves preexisting directories and their contents', async () => {
    const destination = join(await fixture(), 'backup')
    await mkdir(destination)
    await writeFile(join(destination, 'toc.dat'), 'existing')
    await expect(createBackupArtifact(destination)).rejects.toThrow('already exists')
    expect(await readFile(join(destination, 'toc.dat'), 'utf8')).toBe('existing')
  })

  it('publishes directory dumps without nesting or losing entries', async () => {
    const destination = join(await fixture(), 'backup')
    const artifact = await createBackupArtifact(destination)
    await mkdir(artifact.path)
    await writeFile(join(artifact.path, 'toc.dat'), 'complete')
    await artifact.publish(artifact.path)
    await artifact.cleanup()
    expect(await readFile(join(destination, 'toc.dat'), 'utf8')).toBe('complete')
  })
})
