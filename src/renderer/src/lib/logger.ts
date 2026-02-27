import type { LogLevel, StructuredLogEntry } from '@shared/types/logging'
import { ipc } from './ipc-client'

function log(level: LogLevel, scope: string, message: string, context?: Record<string, unknown>): void {
  const entry: StructuredLogEntry = {
    level,
    message,
    timestamp: Date.now(),
    scope: `renderer:${scope}`,
    context,
  }
  void ipc.invoke('log:write', entry)
}

export function createRendererLogger(scope: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) => log('debug', scope, message, context),
    info: (message: string, context?: Record<string, unknown>) => log('info', scope, message, context),
    warn: (message: string, context?: Record<string, unknown>) => log('warn', scope, message, context),
    error: (message: string, context?: Record<string, unknown>) => log('error', scope, message, context),
  }
}
