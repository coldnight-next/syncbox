export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  scope: string
  [key: string]: unknown
}

export interface StructuredLogEntry {
  level: LogLevel
  message: string
  timestamp: number
  scope: string
  context?: Record<string, unknown>
}
