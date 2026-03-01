export type JobStatus =
  | 'pending'
  | 'coalescing'
  | 'queued'
  | 'active'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OperationType = 'create' | 'modify' | 'delete' | 'rename' | 'metadata'

export type ConflictResolution = 'keep-local' | 'keep-remote' | 'keep-both' | 'skip'

export interface SyncJob {
  id: string
  filePath: string
  relativePath: string
  operationType: OperationType
  priority: number
  enqueuedAt: number
  fileSize: number
  retryCount: number
  status: JobStatus
  checksum: string | null
  batchId: string | null
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'paused' | 'error' | 'offline'
  totalJobs: number
  completedJobs: number
  failedJobs: number
  activeJobs: number
  pendingJobs: number
  totalBytes: number
  transferredBytes: number
  estimatedTimeRemainingMs: number
  throughputBytesPerSec: number
}

export interface SyncEvent {
  type: 'file-synced' | 'file-error' | 'conflict-detected' | 'sync-complete' | 'sync-started'
  timestamp: number
  filePath?: string
  error?: string
  details?: Record<string, unknown>
}

export interface ConflictInfo {
  id: string
  filePath: string
  relativePath: string
  localModifiedAt: number
  remoteModifiedAt: number
  localSize: number
  remoteSize: number
  localChecksum: string | null
  remoteChecksum: string | null
  localDeviceId: string | null
  remoteDeviceId: string | null
  conflictType: 'content' | 'rename' | 'delete-modify'
  detectedAt: number
}

export interface ActiveTransfer {
  jobId: string
  filePath: string
  operation: OperationType
  fileSize: number
  bytesTransferred: number
  percentComplete: number
  startedAt: number
  currentSpeed: number
}

export interface SyncProgress {
  overall: SyncStatus
  activeTransfers: ActiveTransfer[]
  recentCompletions: Array<{
    jobId: string
    filePath: string
    operation: OperationType
    duration: number
    completedAt: number
  }>
  errors: {
    totalErrors: number
    retriesInProgress: number
    deadLetterCount: number
    lastError: string | null
  }
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
}

export interface ConcurrencyConfig {
  maxConcurrentUploads: number
  maxConcurrentDownloads: number
  maxConcurrentDeletes: number
  maxConcurrentPerFolder: number
  maxUploadBandwidthBps: number
  maxDownloadBandwidthBps: number
  enableAdaptiveScaling: boolean
  scaleUpThreshold: number
  scaleDownThreshold: number
  minWorkers: number
  maxWorkers: number
}

export interface CoalescingConfig {
  debounceMs: number
  windowMs: number
  maxPendingEvents: number
  ignoredPatterns: string[]
  immediatePatterns: string[]
}

export interface FolderStats {
  path: string
  fileCount: number
  folderCount: number
  totalSizeBytes: number
}
