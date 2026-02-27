export enum SyncState {
  Idle = 'idle',
  Syncing = 'syncing',
  Paused = 'paused',
  Error = 'error',
  Offline = 'offline',
}

export enum JobPriority {
  Critical = 0,
  High = 1,
  Normal = 2,
  NormalModify = 3,
  Low = 4,
  Background = 5,
}

export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  jitterFactor: 1.0,
} as const

export const DEFAULT_CONCURRENCY_CONFIG = {
  maxConcurrentUploads: 4,
  maxConcurrentDownloads: 6,
  maxConcurrentDeletes: 10,
  maxConcurrentPerFolder: 2,
  maxUploadBandwidthBps: 0,
  maxDownloadBandwidthBps: 0,
  enableAdaptiveScaling: true,
  scaleUpThreshold: 0.7,
  scaleDownThreshold: 0.3,
  minWorkers: 1,
  maxWorkers: 8,
} as const

export const DEFAULT_COALESCING_CONFIG = {
  debounceMs: 500,
  windowMs: 2000,
  maxPendingEvents: 10000,
  ignoredPatterns: ['*.tmp', '.git/**', 'node_modules/**', '.DS_Store', 'Thumbs.db'],
  immediatePatterns: [],
} as const
