import log from 'electron-log'
import type { Logger } from '../sync-engine/logger'
import type { StructuredLogEntry } from '../shared/types/logging'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function initLogging(): void {
  log.transports.file.maxSize = MAX_FILE_SIZE
  log.transports.file.format = '{text}'
  log.transports.console.format = '{text}'

  log.hooks.push((message) => {
    const data = message.data as unknown[]
    if (typeof data[0] === 'string' && data[0].startsWith('{')) {
      return message
    }
    const entry: StructuredLogEntry = {
      level: message.level as StructuredLogEntry['level'],
      message: data.map(String).join(' '),
      timestamp: Date.now(),
      scope: 'main',
    }
    message.data = [JSON.stringify(entry)]
    return message
  })

  log.info('Logging initialized')
}

export function createLogger(scope: string): Logger {
  return {
    debug(message: string, context?: Record<string, unknown>): void {
      const entry: StructuredLogEntry = {
        level: 'debug',
        message,
        timestamp: Date.now(),
        scope,
        context,
      }
      log.debug(JSON.stringify(entry))
    },
    info(message: string, context?: Record<string, unknown>): void {
      const entry: StructuredLogEntry = {
        level: 'info',
        message,
        timestamp: Date.now(),
        scope,
        context,
      }
      log.info(JSON.stringify(entry))
    },
    warn(message: string, context?: Record<string, unknown>): void {
      const entry: StructuredLogEntry = {
        level: 'warn',
        message,
        timestamp: Date.now(),
        scope,
        context,
      }
      log.warn(JSON.stringify(entry))
    },
    error(message: string, context?: Record<string, unknown>): void {
      const entry: StructuredLogEntry = {
        level: 'error',
        message,
        timestamp: Date.now(),
        scope,
        context,
      }
      log.error(JSON.stringify(entry))
    },
  }
}

export function writeLogEntry(entry: StructuredLogEntry): void {
  const method = entry.level === 'debug' ? 'debug'
    : entry.level === 'info' ? 'info'
    : entry.level === 'warn' ? 'warn'
    : 'error'
  log[method](JSON.stringify(entry))
}
