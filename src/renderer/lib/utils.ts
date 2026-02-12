import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'vue-sonner'

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num)
}


export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

export const sanitizeName = (value: string): string => {
  return value.replace(/\s/g, '_')
}

export const copyToClipboard = async (text: string, message = 'Copied to clipboard'): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    if (message) toast.success(message)
    return true
  } catch {
    toast.error('Failed to copy to clipboard')
    return false
  }
}

/**
 * Deep-clone an object into a plain JSON-safe structure.
 * Strips Vue reactive proxies, converts BigInt to Number, etc.
 * Use before passing data through Electron's contextBridge / IPC.
 */
export const toPlainObject = <T>(obj: T): T =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
