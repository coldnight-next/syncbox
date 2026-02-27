import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StructuredLogEntry } from '@shared/types/logging'

vi.mock('electron-log', () => {
  const logged: string[] = []
  return {
    default: {
      transports: {
        file: { maxSize: 0, format: '' },
        console: { format: '' },
      },
      hooks: [] as Array<(msg: unknown) => unknown>,
      debug: (msg: string) => logged.push(msg),
      info: (msg: string) => logged.push(msg),
      warn: (msg: string) => logged.push(msg),
      error: (msg: string) => logged.push(msg),
      _logged: logged,
    },
  }
})

let createLogger: typeof import('../../../src/main/logging').createLogger
let writeLogEntry: typeof import('../../../src/main/logging').writeLogEntry
let initLogging: typeof import('../../../src/main/logging').initLogging
let logMock: { _logged: string[] }

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../../src/main/logging')
  createLogger = mod.createLogger
  writeLogEntry = mod.writeLogEntry
  initLogging = mod.initLogging
  const electronLog = await import('electron-log')
  logMock = electronLog.default as unknown as { _logged: string[] }
  logMock._logged.length = 0
})

describe('createLogger', () => {
  it('should produce structured JSON entries with correct scope', () => {
    const logger = createLogger('sync-engine')
    logger.info('file synced', { path: '/test.txt' })

    expect(logMock._logged.length).toBe(1)
    const entry: StructuredLogEntry = JSON.parse(logMock._logged[0])
    expect(entry.level).toBe('info')
    expect(entry.scope).toBe('sync-engine')
    expect(entry.message).toBe('file synced')
    expect(entry.context).toEqual({ path: '/test.txt' })
    expect(entry.timestamp).toBeTypeOf('number')
  })

  it('should support all log levels', () => {
    const logger = createLogger('test')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(logMock._logged.length).toBe(4)
    const levels = logMock._logged.map((l) => JSON.parse(l).level)
    expect(levels).toEqual(['debug', 'info', 'warn', 'error'])
  })

  it('should handle entries without context', () => {
    const logger = createLogger('bare')
    logger.info('no context')

    const entry: StructuredLogEntry = JSON.parse(logMock._logged[0])
    expect(entry.context).toBeUndefined()
  })
})

describe('writeLogEntry', () => {
  it('should write a pre-built entry at the correct level', () => {
    const entry: StructuredLogEntry = {
      level: 'warn',
      message: 'renderer warning',
      timestamp: Date.now(),
      scope: 'renderer:app',
    }
    writeLogEntry(entry)

    expect(logMock._logged.length).toBe(1)
    const parsed: StructuredLogEntry = JSON.parse(logMock._logged[0])
    expect(parsed.level).toBe('warn')
    expect(parsed.scope).toBe('renderer:app')
  })
})

describe('initLogging', () => {
  it('should configure electron-log transports', async () => {
    const electronLog = await import('electron-log')
    const log = electronLog.default as unknown as {
      transports: { file: { maxSize: number } }
    }
    initLogging()
    expect(log.transports.file.maxSize).toBe(5 * 1024 * 1024)
  })
})
