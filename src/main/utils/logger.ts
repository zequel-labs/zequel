import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, appendFileSync } from 'fs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private logDir: string
  private logFile: string
  private isDev: boolean

  constructor() {
    this.isDev = !app.isPackaged
    this.logDir = join(app.getPath('userData'), 'logs')
    this.logFile = join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`)

    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    const formatted = this.formatMessage(level, message, meta)

    // Console output in development
    if (this.isDev) {
      switch (level) {
        case 'debug':
          console.debug(formatted)
          break
        case 'info':
          console.info(formatted)
          break
        case 'warn':
          console.warn(formatted)
          break
        case 'error':
          console.error(formatted)
          break
      }
    }

    // File output
    try {
      appendFileSync(this.logFile, formatted + '\n')
    } catch {
      // Ignore file write errors
    }
  }

  debug(message: string, meta?: unknown): void {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: unknown): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: unknown): void {
    this.log('warn', message, meta)
  }

  error(message: string, meta?: unknown): void {
    this.log('error', message, meta)
  }
}

export const logger = new Logger()
