import { unlink, writeFile, mkdtemp, rmdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { SSLMode, type SSLConfig } from '@main/types'

/**
 * Write SSL cert/key/ca PEM content to secure temp files for CLI tools.
 * Returns the temp file paths and the temp directory for cleanup.
 */
export const writeSslTempFiles = async (
  sslConfig: SSLConfig
): Promise<{ ca?: string; cert?: string; key?: string; dir: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'zequel-ssl-'))
  const result: { ca?: string; cert?: string; key?: string; dir: string } = { dir }

  try {
    if (sslConfig.ca) {
      const caPath = join(dir, 'ca.pem')
      await writeFile(caPath, sslConfig.ca, { mode: 0o600 })
      result.ca = caPath
    }
    if (sslConfig.cert) {
      const certPath = join(dir, 'cert.pem')
      await writeFile(certPath, sslConfig.cert, { mode: 0o600 })
      result.cert = certPath
    }
    if (sslConfig.key) {
      const keyPath = join(dir, 'key.pem')
      await writeFile(keyPath, sslConfig.key, { mode: 0o600 })
      result.key = keyPath
    }
  } catch (err) {
    // Clean up partially created temp files and directory on failure
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw err
  }

  return result
}

/** Remove temp SSL files, extraction directories, and their parent directories. */
export const cleanupTempFiles = async (files: string[]): Promise<void> => {
  const parentDirs = new Set<string>()
  for (const f of files) {
    try {
      await unlink(f)
      parentDirs.add(join(f, '..'))
    } catch {
      // unlink fails on directories — fall back to recursive rm
      try { await rm(f, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  for (const d of parentDirs) {
    try { await rmdir(d) } catch { /* ignore — dir may not be empty */ }
  }
}

/** Map SSLMode enum to PostgreSQL sslmode string. */
export const pgSslMode = (mode?: SSLMode): string => {
  switch (mode) {
    case SSLMode.Disable: return 'disable'
    case SSLMode.Prefer: return 'prefer'
    case SSLMode.Require: return 'require'
    case SSLMode.VerifyCA: return 'verify-ca'
    case SSLMode.VerifyFull: return 'verify-full'
    default: return 'require'
  }
}

/** Map SSLMode to MySQL --ssl-mode value. MariaDB uses --ssl / --ssl-verify-server-cert instead. */
export const mysqlSslMode = (mode?: SSLMode): string => {
  switch (mode) {
    case SSLMode.VerifyCA: return 'VERIFY_CA'
    case SSLMode.VerifyFull: return 'VERIFY_IDENTITY'
    default: return 'REQUIRED'
  }
}
