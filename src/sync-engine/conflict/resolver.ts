import path from 'node:path'
import type { VectorClock } from '../../shared/types/peer'
import type { Logger } from '../logger'

export type ConflictStrategy = 'keep-newest' | 'keep-both' | 'ask'

export interface ConflictContext {
  relativePath: string
  localChecksum: string
  remoteChecksum: string
  localDeviceId: string
  remoteDeviceId: string
  localClock: VectorClock
  remoteClock: VectorClock
  localModifiedAt: number
  remoteModifiedAt: number
  conflictType: 'content' | 'rename' | 'delete-modify'
}

export type ConflictResult =
  | { action: 'keep-local' }
  | { action: 'keep-remote' }
  | { action: 'keep-both'; conflictFilename: string }
  | { action: 'ask'; conflictId: string }

export class ConflictResolver {
  private strategy: ConflictStrategy
  private logger: Logger
  private pendingConflicts = new Map<string, ConflictContext>()

  constructor(strategy: ConflictStrategy, logger: Logger) {
    this.strategy = strategy
    this.logger = logger
  }

  resolve(context: ConflictContext): ConflictResult {
    this.logger.info('Resolving conflict', {
      path: context.relativePath,
      strategy: this.strategy,
      type: context.conflictType,
    })

    switch (this.strategy) {
      case 'keep-newest':
        return this.resolveKeepNewest(context)
      case 'keep-both':
        return this.resolveKeepBoth(context)
      case 'ask':
        return this.resolveAsk(context)
    }
  }

  getPendingConflicts(): Map<string, ConflictContext> {
    return this.pendingConflicts
  }

  resolveManual(
    conflictId: string,
    resolution: 'keep-local' | 'keep-remote' | 'keep-both',
  ): ConflictResult | null {
    const context = this.pendingConflicts.get(conflictId)
    if (!context) return null

    this.pendingConflicts.delete(conflictId)

    if (resolution === 'keep-local') return { action: 'keep-local' }
    if (resolution === 'keep-remote') return { action: 'keep-remote' }
    return { action: 'keep-both', conflictFilename: this.generateConflictFilename(context) }
  }

  private resolveKeepNewest(context: ConflictContext): ConflictResult {
    if (context.localModifiedAt > context.remoteModifiedAt) {
      return { action: 'keep-local' }
    }
    if (context.remoteModifiedAt > context.localModifiedAt) {
      return { action: 'keep-remote' }
    }
    // Tie-break by deviceId (lexicographic)
    if (context.localDeviceId < context.remoteDeviceId) {
      return { action: 'keep-local' }
    }
    return { action: 'keep-remote' }
  }

  private resolveKeepBoth(context: ConflictContext): ConflictResult {
    return {
      action: 'keep-both',
      conflictFilename: this.generateConflictFilename(context),
    }
  }

  private resolveAsk(context: ConflictContext): ConflictResult {
    const conflictId = `${context.relativePath}-${Date.now()}`
    this.pendingConflicts.set(conflictId, context)
    return { action: 'ask', conflictId }
  }

  private generateConflictFilename(context: ConflictContext): string {
    const ext = path.extname(context.relativePath)
    const base = context.relativePath.slice(0, -ext.length || undefined)
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const deviceTag = context.remoteDeviceId.slice(0, 8)
    return `${base}.sync-conflict-${date}-${deviceTag}${ext}`
  }
}
