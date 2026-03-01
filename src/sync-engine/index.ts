import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type {
  SyncStatus,
  SyncEvent,
  ConflictInfo,
  ConflictResolution,
  CoalescingConfig,
} from '../shared/types/sync'
import type { PeerMessage, FileManifestEntry, FolderConfigPayload } from '../shared/types/peer'
import type { AppConfig } from '../shared/types/config'
import type { TransferStats, TransferDataPoint, StatsTimeRange } from '../shared/types/stats'
import { relativeSyncPath } from '../shared/utils/paths'
import { FileWatcher } from './watcher'
import { MetadataStore } from './metadata-store'
import { hashFile } from './hasher'
import { PeerManager } from './p2p/peer-manager'
import {
  createManifestMessage,
  createFileRequestMessage,
  createFileDataMessage,
  createFileDataEndMessage,
  createFolderConfigMessage,
  splitFileIntoChunks,
  reassembleChunks,
} from './p2p/protocol'
import {
  createClock,
  incrementClock,
  mergeClock,
  compareClock,
} from './conflict/vector-clock'
import { ConflictResolver } from './conflict/resolver'
import type { ConflictStrategy, ConflictContext } from './conflict/resolver'
import type { Logger } from './logger'
import { createNoopLogger } from './logger'
import { TokenBucketThrottler } from './throttler'
import { StatsCollector } from './stats-collector'
import { sampleCpuUsage, computeAutoFraction } from './auto-throttle'

export interface SyncEngineOptions {
  watchPaths: string[]
  dbPath: string
  deviceId: string
  config: CoalescingConfig
  conflictStrategy?: ConflictStrategy
  logger?: Logger
  onEvent: (event: SyncEvent) => void
  onStatusChange: (status: SyncStatus) => void
  onFolderConfigReceived?: (payload: FolderConfigPayload) => void
}

/** Tracks in-flight file receives from peers */
interface PendingReceive {
  relativePath: string
  syncRoot: string
  chunks: Map<number, Buffer>
  checksum: string | null
  totalChunks: number | null
  fromDeviceId: string
}

export class SyncEngine {
  private running = false
  private paused = false
  private options: SyncEngineOptions
  private logger: Logger
  private watcher: FileWatcher | null = null
  private metadataStore: MetadataStore
  private conflictResolver: ConflictResolver
  private peerManager: PeerManager | null = null

  // Track in-progress file transfers from peers
  private pendingReceives = new Map<string, PendingReceive>()

  // Debounce manifest broadcasts
  private manifestBroadcastTimer: ReturnType<typeof setTimeout> | null = null

  // Track stats
  private completedJobs = 0
  private failedJobs = 0
  private activeJobs = 0
  private totalBytes = 0
  private transferredBytes = 0

  // Throttling
  private uploadThrottler = new TokenBucketThrottler(0)
  private downloadThrottler = new TokenBucketThrottler(0)
  private autoThrottleTimer: ReturnType<typeof setInterval> | null = null

  // Stats collection
  private statsCollector: StatsCollector | null = null

  constructor(options: SyncEngineOptions) {
    this.options = options
    this.logger = options.logger ?? createNoopLogger()
    this.metadataStore = new MetadataStore()
    this.conflictResolver = new ConflictResolver(
      options.conflictStrategy ?? 'ask',
      this.logger,
    )
  }

  /** Attach a PeerManager for P2P sync. Call before start(). */
  setPeerManager(pm: PeerManager): void {
    this.peerManager = pm
  }

  /** Update the watched folder paths. Takes effect on next start() or immediately if already running. */
  setWatchPaths(paths: string[]): void {
    this.options.watchPaths = paths
  }

  /** Update config — adjusts throttler rates based on bandwidth preset. */
  updateConfig(config: AppConfig): void {
    // Stop any existing auto-throttle timer
    if (this.autoThrottleTimer) {
      clearInterval(this.autoThrottleTimer)
      this.autoThrottleTimer = null
    }

    switch (config.bandwidthPreset) {
      case 'no-limit':
        this.uploadThrottler.setRate(0)
        this.downloadThrottler.setRate(0)
        break
      case 'custom': {
        const upRate = config.customUploadKBps * 1024
        const downRate = config.customDownloadKBps * 1024
        this.uploadThrottler.setRate(upRate)
        this.downloadThrottler.setRate(downRate)
        break
      }
      case 'auto':
        // Set a base rate, then let the auto-throttle adjust
        this.uploadThrottler.setRate(0)
        this.downloadThrottler.setRate(0)
        this.autoThrottleTimer = setInterval(() => {
          void this.autoAdjustThrottle()
        }, 5000)
        break
    }

    this.logger.info('Config updated', { bandwidthPreset: config.bandwidthPreset })
  }

  /** Get transfer stats for a given time range. */
  getStats(range: StatsTimeRange): TransferStats {
    if (!this.statsCollector) {
      return { points: [], totalUploadBytes: 0, totalDownloadBytes: 0, totalFilesTransferred: 0, peakUploadBytesPerSec: 0, peakDownloadBytesPerSec: 0 }
    }
    return this.statsCollector.getStats(range)
  }

  /** Get the current-minute realtime data point. */
  getRealtimePoint(): TransferDataPoint {
    if (!this.statsCollector) {
      return { timestamp: Date.now(), uploadBytes: 0, downloadBytes: 0, filesTransferred: 0 }
    }
    return this.statsCollector.getRealtimePoint()
  }

  private async autoAdjustThrottle(): Promise<void> {
    try {
      const cpuUsage = await sampleCpuUsage(500)
      const fraction = computeAutoFraction(cpuUsage)
      // Use a baseline of 10 MB/s and scale down
      const baseRate = 10 * 1024 * 1024
      const rate = Math.round(baseRate * fraction)
      this.uploadThrottler.setRate(rate)
      this.downloadThrottler.setRate(rate)
    } catch {
      // Silently ignore CPU sampling errors
    }
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.paused = false

    // Open database
    this.metadataStore.open(this.options.dbPath)
    this.statsCollector = new StatsCollector(this.metadataStore)
    this.logger.info('MetadataStore opened', { dbPath: this.options.dbPath })

    // Start file watcher if we have paths
    if (this.options.watchPaths.length > 0) {
      this.watcher = new FileWatcher({
        paths: this.options.watchPaths,
        ignoredPatterns: this.options.config.ignoredPatterns,
        onEvent: (event) => {
          void this.handleLocalFileEvent(event.type, event.path)
        },
        onReady: () => {
          this.logger.info('File watcher ready')
          // Do initial scan
          void this.performInitialScan()
        },
        onError: (err) => {
          this.logger.error('File watcher error', { error: String(err) })
        },
      })
      await this.watcher.start()
      this.logger.info('FileWatcher started', { paths: this.options.watchPaths })
    }

    this.emitStatusChange()
    this.options.onEvent({ type: 'sync-started', timestamp: Date.now() })
    this.logger.info('SyncEngine started')
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    this.paused = false

    if (this.autoThrottleTimer) {
      clearInterval(this.autoThrottleTimer)
      this.autoThrottleTimer = null
    }

    if (this.manifestBroadcastTimer) {
      clearTimeout(this.manifestBroadcastTimer)
      this.manifestBroadcastTimer = null
    }

    if (this.watcher) {
      await this.watcher.stop()
      this.watcher = null
    }

    this.metadataStore.close()
    this.pendingReceives.clear()
    this.logger.info('SyncEngine stopped')
    this.emitStatusChange()
  }

  async pause(): Promise<void> {
    if (!this.running || this.paused) return
    this.paused = true
    this.emitStatusChange()
  }

  async resume(): Promise<void> {
    if (!this.running || !this.paused) return
    this.paused = false
    this.emitStatusChange()
  }

  async forceSync(_filePath?: string): Promise<void> {
    if (!this.running || this.paused) return
    this.options.onEvent({ type: 'sync-started', timestamp: Date.now() })

    // Re-scan and broadcast manifest
    await this.performInitialScan()
    this.broadcastManifest()
  }

  getStatus(): SyncStatus {
    return {
      state: !this.running ? 'idle' : this.paused ? 'paused' : this.activeJobs > 0 ? 'syncing' : 'idle',
      totalJobs: this.completedJobs + this.failedJobs + this.activeJobs,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      activeJobs: this.activeJobs,
      pendingJobs: 0,
      totalBytes: this.totalBytes,
      transferredBytes: this.transferredBytes,
      estimatedTimeRemainingMs: 0,
      throughputBytesPerSec: 0,
    }
  }

  getConflicts(): ConflictInfo[] {
    const pending = this.conflictResolver.getPendingConflicts()
    const conflicts: ConflictInfo[] = []
    for (const [id, ctx] of pending) {
      const syncRoot = this.options.watchPaths[0] ?? ''
      conflicts.push({
        id,
        filePath: path.join(syncRoot, ctx.relativePath),
        relativePath: ctx.relativePath,
        localModifiedAt: ctx.localModifiedAt,
        remoteModifiedAt: ctx.remoteModifiedAt,
        localSize: 0,
        remoteSize: 0,
        localChecksum: ctx.localChecksum,
        remoteChecksum: ctx.remoteChecksum,
        localDeviceId: ctx.localDeviceId,
        remoteDeviceId: ctx.remoteDeviceId,
        conflictType: ctx.conflictType,
        detectedAt: Date.now(),
      })
    }
    return conflicts
  }

  async resolveConflict(id: string, resolution: ConflictResolution): Promise<void> {
    if (resolution === 'skip') {
      // Just remove from pending
      this.conflictResolver.getPendingConflicts().delete(id)
      return
    }
    const mapped = resolution === 'keep-both' ? 'keep-both' : resolution === 'keep-local' ? 'keep-local' : 'keep-remote'
    this.conflictResolver.resolveManual(id, mapped)
    this.logger.info('Conflict resolved', { id, resolution })
  }

  /** Handle an incoming P2P message from a connected peer. Called by PeerManager's onMessage callback. */
  handlePeerMessage(fromDeviceId: string, msg: PeerMessage): void {
    // folder-config must be processed even when engine is stopped/paused
    // because it bootstraps the sync folder list on new devices
    if (msg.type === 'folder-config') {
      if (this.options.onFolderConfigReceived) {
        this.options.onFolderConfigReceived(msg.payload as FolderConfigPayload)
      }
      return
    }

    if (this.paused || !this.running) return

    switch (msg.type) {
      case 'manifest':
        void this.handleIncomingManifest(fromDeviceId, msg.payload as FileManifestEntry[])
        break
      case 'file-request':
        void this.handleFileRequest(fromDeviceId, msg.payload as { relativePath: string; syncRoot?: string }, msg.id)
        break
      case 'file-data':
        this.handleFileData(msg.payload as { requestId: string; chunkIndex: number; data: string }, fromDeviceId)
        break
      case 'file-data-end':
        void this.handleFileDataEnd(msg.payload as { requestId: string; totalChunks: number; checksum: string })
        break
      default:
        break
    }
  }

  /** Broadcast folder config to all connected peers. */
  broadcastFolderConfig(action: FolderConfigPayload['action'], folders?: string[]): void {
    if (!this.peerManager) return
    const foldersToSend = folders ?? this.options.watchPaths
    const msg = createFolderConfigMessage(foldersToSend, action)
    this.peerManager.broadcast(msg)
    this.logger.info('Broadcast folder config', { action, folders: foldersToSend })
  }

  dispose(): void {
    this.running = false
    this.paused = false
    if (this.manifestBroadcastTimer) {
      clearTimeout(this.manifestBroadcastTimer)
    }
    if (this.autoThrottleTimer) {
      clearInterval(this.autoThrottleTimer)
      this.autoThrottleTimer = null
    }
    this.metadataStore.close()
  }

  // ── Private Methods ──────────────────────────────────────────────────

  private async performInitialScan(): Promise<void> {
    for (const syncRoot of this.options.watchPaths) {
      await this.scanDirectory(syncRoot, syncRoot)
    }
    this.logger.info('Initial scan complete')
    // Broadcast manifest to peers so they know what files we have
    this.broadcastManifest()
  }

  private async scanDirectory(dir: string, syncRoot: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Skip ignored directories
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.syncbox') {
          continue
        }
        await this.scanDirectory(fullPath, syncRoot)
      } else if (entry.isFile()) {
        await this.indexFile(fullPath, syncRoot)
      }
    }
  }

  private async indexFile(filePath: string, syncRoot: string): Promise<void> {
    try {
      const stat = fs.statSync(filePath)
      const relPath = relativeSyncPath(filePath, syncRoot)
      const existing = this.metadataStore.getFileMetadata(filePath)

      // Skip if file hasn't changed since last index
      if (existing && existing.modifiedAt >= stat.mtimeMs) {
        return
      }

      const checksum = await hashFile(filePath)

      this.metadataStore.upsertFileMetadata({
        path: filePath,
        relativePath: relPath,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        checksum,
        syncedAt: Date.now(),
      })

      // Ensure a vector clock exists for this file
      let clock = this.metadataStore.getVectorClock(relPath)
      if (!clock) {
        clock = incrementClock(createClock(), this.options.deviceId)
        this.metadataStore.setVectorClock(relPath, clock)
      }
    } catch (err) {
      this.logger.error('Failed to index file', { filePath, error: String(err) })
    }
  }

  private async handleLocalFileEvent(eventType: string, filePath: string): Promise<void> {
    if (this.paused || !this.running) return

    const syncRoot = this.findSyncRoot(filePath)
    if (!syncRoot) return

    const relPath = relativeSyncPath(filePath, syncRoot)
    this.logger.debug('Local file event', { type: eventType, relPath })

    if (eventType === 'delete') {
      this.metadataStore.deleteFileMetadata(filePath)
      // Increment vector clock even for deletes
      let clock = this.metadataStore.getVectorClock(relPath) ?? createClock()
      clock = incrementClock(clock, this.options.deviceId)
      this.metadataStore.setVectorClock(relPath, clock)
    } else {
      // create or modify
      await this.indexFile(filePath, syncRoot)
      // Increment vector clock
      let clock = this.metadataStore.getVectorClock(relPath) ?? createClock()
      clock = incrementClock(clock, this.options.deviceId)
      this.metadataStore.setVectorClock(relPath, clock)
    }

    this.options.onEvent({
      type: 'file-synced',
      timestamp: Date.now(),
      filePath,
    })

    // Debounce manifest broadcast to avoid flooding
    this.scheduleBroadcast()
  }

  private scheduleBroadcast(): void {
    if (this.manifestBroadcastTimer) return
    this.manifestBroadcastTimer = setTimeout(() => {
      this.manifestBroadcastTimer = null
      this.broadcastManifest()
    }, 1000)
  }

  private broadcastManifest(): void {
    if (!this.peerManager || this.paused) return

    const manifest = this.buildManifest()
    if (manifest.length === 0) return

    const msg = createManifestMessage(manifest)
    this.peerManager.broadcast(msg)
    this.logger.debug('Broadcast manifest', { entries: manifest.length })
  }

  private buildManifest(): FileManifestEntry[] {
    const entries: FileManifestEntry[] = []
    for (const syncRoot of this.options.watchPaths) {
      this.collectManifestEntries(syncRoot, syncRoot, entries)
    }
    return entries
  }

  private collectManifestEntries(dir: string, syncRoot: string, entries: FileManifestEntry[]): void {
    let dirEntries: fs.Dirent[]
    try {
      dirEntries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.syncbox') continue
        this.collectManifestEntries(fullPath, syncRoot, entries)
      } else if (entry.isFile()) {
        const meta = this.metadataStore.getFileMetadata(fullPath)
        if (!meta) continue
        const clock = this.metadataStore.getVectorClock(meta.relativePath) ?? createClock()
        entries.push({
          relativePath: meta.relativePath,
          size: meta.size,
          modifiedAt: meta.modifiedAt,
          checksum: meta.checksum,
          clock,
          syncRoot,
        })
      }
    }
  }

  private async handleIncomingManifest(fromDeviceId: string, remoteEntries: FileManifestEntry[]): Promise<void> {
    this.logger.info('Received manifest from peer', {
      fromDeviceId,
      entries: remoteEntries.length,
    })

    for (const remoteEntry of remoteEntries) {
      const syncRoot = remoteEntry.syncRoot ?? this.options.watchPaths[0]
      if (!syncRoot) continue

      const localClock = this.metadataStore.getVectorClock(remoteEntry.relativePath)
      const localMeta = this.findLocalMetadata(remoteEntry.relativePath)

      if (!localClock) {
        // We don't have this file — request it
        this.requestFile(fromDeviceId, remoteEntry.relativePath, syncRoot)
        continue
      }

      const comparison = compareClock(localClock, remoteEntry.clock)

      if (comparison === 'equal') {
        // Same version — skip
        continue
      }

      if (comparison === 'before') {
        // Remote is newer — request file
        this.requestFile(fromDeviceId, remoteEntry.relativePath, syncRoot)
        continue
      }

      if (comparison === 'after') {
        // Local is newer — remote will request from us, nothing to do
        continue
      }

      // Concurrent — conflict!
      const conflictContext: ConflictContext = {
        relativePath: remoteEntry.relativePath,
        localChecksum: localMeta?.checksum ?? '',
        remoteChecksum: remoteEntry.checksum,
        localDeviceId: this.options.deviceId,
        remoteDeviceId: fromDeviceId,
        localClock,
        remoteClock: remoteEntry.clock,
        localModifiedAt: localMeta?.modifiedAt ?? 0,
        remoteModifiedAt: remoteEntry.modifiedAt,
        conflictType: 'content',
      }

      const result = this.conflictResolver.resolve(conflictContext)
      this.logger.info('Conflict detected', {
        path: remoteEntry.relativePath,
        resolution: result.action,
      })

      this.options.onEvent({
        type: 'conflict-detected',
        timestamp: Date.now(),
        filePath: remoteEntry.relativePath,
        details: { action: result.action },
      })

      if (result.action === 'keep-remote' || result.action === 'keep-both') {
        // Request the remote version
        this.requestFile(fromDeviceId, remoteEntry.relativePath, syncRoot)
      }
      // For keep-local or ask, we don't fetch the remote file

      // Merge clocks regardless
      const merged = mergeClock(localClock, remoteEntry.clock)
      this.metadataStore.setVectorClock(remoteEntry.relativePath, merged)
    }
  }

  private requestFile(fromDeviceId: string, relativePath: string, syncRoot?: string): void {
    if (!this.peerManager) return

    this.activeJobs++
    this.emitStatusChange()

    const resolvedRoot = syncRoot ?? this.options.watchPaths[0] ?? ''
    const msg = createFileRequestMessage(relativePath, resolvedRoot)

    // Set up pending receive tracker
    this.pendingReceives.set(msg.id, {
      relativePath,
      syncRoot: resolvedRoot,
      chunks: new Map(),
      checksum: null,
      totalChunks: null,
      fromDeviceId,
    })

    this.peerManager.sendTo(fromDeviceId, msg)
    this.logger.debug('Requested file', { relativePath, fromDeviceId })
  }

  private async handleFileRequest(
    fromDeviceId: string,
    payload: { relativePath: string; syncRoot?: string },
    requestId: string,
  ): Promise<void> {
    if (!this.peerManager) return

    const syncRoot = payload.syncRoot ?? this.options.watchPaths[0]
    if (!syncRoot) return

    const fullPath = path.join(syncRoot, payload.relativePath)

    try {
      const data = fs.readFileSync(fullPath)
      const checksum = crypto.createHash('sha256').update(data).digest('hex')
      const chunks = splitFileIntoChunks(data)

      this.totalBytes += data.length

      for (let i = 0; i < chunks.length; i++) {
        await this.uploadThrottler.consume(chunks[i].length)
        const chunkMsg = createFileDataMessage(requestId, i, chunks[i])
        this.peerManager.sendTo(fromDeviceId, chunkMsg)
        this.statsCollector?.recordUpload(chunks[i].length)
      }

      const endMsg = createFileDataEndMessage(requestId, chunks.length, checksum)
      this.peerManager.sendTo(fromDeviceId, endMsg)

      this.transferredBytes += data.length
      this.statsCollector?.recordFileTransferred()
      this.logger.debug('Sent file', { relativePath: payload.relativePath, chunks: chunks.length })
    } catch (err) {
      this.logger.error('Failed to send file', { path: payload.relativePath, error: String(err) })
    }
  }

  private handleFileData(
    payload: { requestId: string; chunkIndex: number; data: string },
    _fromDeviceId: string,
  ): void {
    const pending = this.pendingReceives.get(payload.requestId)
    if (!pending) return

    const chunkBuf = Buffer.from(payload.data, 'base64')
    pending.chunks.set(payload.chunkIndex, chunkBuf)
    this.statsCollector?.recordDownload(chunkBuf.length)
  }

  private async handleFileDataEnd(
    payload: { requestId: string; totalChunks: number; checksum: string },
  ): Promise<void> {
    const pending = this.pendingReceives.get(payload.requestId)
    if (!pending) return

    this.pendingReceives.delete(payload.requestId)

    // Reassemble chunks in order
    const orderedChunks: Buffer[] = []
    for (let i = 0; i < payload.totalChunks; i++) {
      const chunk = pending.chunks.get(i)
      if (!chunk) {
        this.logger.error('Missing chunk in file transfer', {
          relativePath: pending.relativePath,
          chunkIndex: i,
        })
        this.activeJobs = Math.max(0, this.activeJobs - 1)
        this.failedJobs++
        this.emitStatusChange()
        return
      }
      orderedChunks.push(chunk)
    }

    const data = reassembleChunks(orderedChunks)

    // Verify checksum
    const receivedChecksum = crypto.createHash('sha256').update(data).digest('hex')
    if (receivedChecksum !== payload.checksum) {
      this.logger.error('Checksum mismatch for received file', {
        relativePath: pending.relativePath,
        expected: payload.checksum,
        received: receivedChecksum,
      })
      this.activeJobs = Math.max(0, this.activeJobs - 1)
      this.failedJobs++
      this.emitStatusChange()
      return
    }

    // Write file to disk
    const syncRoot = pending.syncRoot || this.options.watchPaths[0]
    if (!syncRoot) return

    const fullPath = path.join(syncRoot, pending.relativePath)

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath)
      fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(fullPath, data)

      const stat = fs.statSync(fullPath)

      // Update metadata store
      this.metadataStore.upsertFileMetadata({
        path: fullPath,
        relativePath: pending.relativePath,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        checksum: payload.checksum,
        syncedAt: Date.now(),
      })

      // Merge vector clock with remote
      const localClock = this.metadataStore.getVectorClock(pending.relativePath) ?? createClock()
      const remoteClock = incrementClock(createClock(), pending.fromDeviceId)
      const merged = mergeClock(localClock, remoteClock)
      this.metadataStore.setVectorClock(pending.relativePath, merged)

      this.activeJobs = Math.max(0, this.activeJobs - 1)
      this.completedJobs++
      this.transferredBytes += data.length
      this.statsCollector?.recordFileTransferred()
      this.emitStatusChange()

      this.options.onEvent({
        type: 'file-synced',
        timestamp: Date.now(),
        filePath: pending.relativePath,
      })

      this.logger.info('File received and written', {
        relativePath: pending.relativePath,
        size: data.length,
      })
    } catch (err) {
      this.logger.error('Failed to write received file', {
        path: pending.relativePath,
        error: String(err),
      })
      this.activeJobs = Math.max(0, this.activeJobs - 1)
      this.failedJobs++
      this.emitStatusChange()
    }
  }

  private findSyncRoot(filePath: string): string | null {
    for (const root of this.options.watchPaths) {
      if (filePath.startsWith(root)) return root
    }
    return null
  }

  private findLocalMetadata(relativePath: string): { checksum: string; modifiedAt: number } | null {
    // Search through watch paths for the file
    for (const syncRoot of this.options.watchPaths) {
      const fullPath = path.join(syncRoot, relativePath)
      const meta = this.metadataStore.getFileMetadata(fullPath)
      if (meta) return { checksum: meta.checksum, modifiedAt: meta.modifiedAt }
    }
    return null
  }

  private emitStatusChange(): void {
    this.options.onStatusChange(this.getStatus())
  }
}
