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

/**
 * Append MongoDB TLS flags (mongodump/mongorestore) for the given SSL config, writing any
 * cert/key temp files and tracking them in `tempFiles` for cleanup. MongoDB expects a single
 * PEM holding both cert and key, so they're concatenated into one file. Mutates `args`/`tempFiles`.
 */
export const appendMongoTlsArgs = async (
  args: string[],
  tempFiles: string[],
  ssl: boolean,
  sslConfig: SSLConfig | null
): Promise<void> => {
  if (!ssl) return
  args.push('--tls')
  if (!sslConfig) return
  if (sslConfig.rejectUnauthorized === false) args.push('--tlsInsecure')
  const files = await writeSslTempFiles(sslConfig)
  if (files.ca) { args.push(`--tlsCAFile=${files.ca}`); tempFiles.push(files.ca) }
  if (files.cert && files.key) {
    // Concatenate cert + key into the single PEM MongoDB's --tlsCertificateKeyFile expects.
    await writeFile(files.cert, sslConfig.cert + '\n' + sslConfig.key, { mode: 0o600 })
    args.push(`--tlsCertificateKeyFile=${files.cert}`)
    tempFiles.push(files.cert, files.key)
  } else if (files.cert) {
    args.push(`--tlsCertificateKeyFile=${files.cert}`)
    tempFiles.push(files.cert)
  } else if (files.key) {
    args.push(`--tlsCertificateKeyFile=${files.key}`)
    tempFiles.push(files.key)
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
