/** Max bytes of stdout/stderr kept in memory per operation */
export const MAX_LOG_BYTES = 512 * 1024 // 512KB

/** Split a custom args string respecting single/double quotes (e.g. --config="/path with spaces/f.ini"). */
export const parseCustomArgs = (input: string): string[] => {
  const args: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (/\s/.test(ch) && !inSingle && !inDouble) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) args.push(current)
  return args
}

export const formatDisplayCommand = (
  binary: string,
  args: string[],
  env: Record<string, string>
): string => {
  const envStr = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  const escapedArgs = args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')
  return envStr ? `${envStr} ${binary} ${escapedArgs}` : `${binary} ${escapedArgs}`
}

/** Append text to a log string, keeping it under MAX_LOG_BYTES.
 *  Keeps both the HEAD (where errors usually start) and the TAIL (latest output) so a long
 *  log never loses the beginning of an error message — only the middle is dropped. */
export const appendLog = (current: string, chunk: string): string => {
  const combined = current + chunk
  if (combined.length <= MAX_LOG_BYTES) return combined

  const marker = '\n...(truncated)...\n'
  const headBytes = Math.floor(MAX_LOG_BYTES / 4)
  const tailBytes = MAX_LOG_BYTES - headBytes - marker.length
  const head = combined.slice(0, headBytes)
  const tail = combined.slice(combined.length - tailBytes)
  return head + marker + tail
}

/**
 * Build minimal spawn env: only PATH + operation-specific env vars.
 * Avoids leaking the full process.env to child processes.
 */
export const buildSpawnEnv = (extraEnv: Record<string, string>): Record<string, string> => {
  const base: Record<string, string> = {}
  const passthrough = [
    'PATH',                   // binary & shared library lookup
    'HOME',                   // .pgpass, .my.cnf, etc.
    'USERPROFILE',            // Windows HOME equivalent
    'TMPDIR', 'TEMP', 'TMP', // temp directories
    'LANG', 'LC_ALL',        // locale / encoding
    'SystemRoot',             // Windows DLL / system calls
    'LD_LIBRARY_PATH',        // Linux shared libraries
    'DYLD_LIBRARY_PATH',      // macOS shared libraries
    'DYLD_FALLBACK_LIBRARY_PATH',
  ]
  for (const key of passthrough) {
    if (process.env[key]) base[key] = process.env[key]!
  }
  return { ...base, ...extraEnv }
}
