import type { TransferDataPoint, TransferStats, StatsTimeRange } from '../shared/types/stats'
import type { MetadataStore } from './metadata-store'

/**
 * Records transfer statistics and buckets them into per-minute data points.
 * Uses MetadataStore (SQLite) for persistent storage.
 */
export class StatsCollector {
  private store: MetadataStore

  // Current-minute accumulators (flushed to DB periodically)
  private currentMinute: number
  private currentUpload = 0
  private currentDownload = 0
  private currentFiles = 0
  private flushTimer: ReturnType<typeof setInterval>

  constructor(store: MetadataStore) {
    this.store = store
    this.currentMinute = this.minuteBucket(Date.now())

    // Flush accumulators to DB every 10 seconds
    this.flushTimer = setInterval(() => this.flush(), 10000)
  }

  recordUpload(bytes: number): void {
    this.maybeRotateBucket()
    this.currentUpload += bytes
  }

  recordDownload(bytes: number): void {
    this.maybeRotateBucket()
    this.currentDownload += bytes
  }

  recordFileTransferred(): void {
    this.maybeRotateBucket()
    this.currentFiles++
  }

  getRealtimePoint(): TransferDataPoint {
    return {
      timestamp: this.currentMinute,
      uploadBytes: this.currentUpload,
      downloadBytes: this.currentDownload,
      filesTransferred: this.currentFiles,
    }
  }

  getStats(range: StatsTimeRange): TransferStats {
    this.flush() // Ensure current data is persisted

    const now = Date.now()
    let fromTs: number
    switch (range) {
      case 'day':
        fromTs = now - 24 * 60 * 60 * 1000
        break
      case 'week':
        fromTs = now - 7 * 24 * 60 * 60 * 1000
        break
      case 'month':
        fromTs = now - 31 * 24 * 60 * 60 * 1000
        break
    }

    const rows = this.store.getTransferStats(fromTs, now)

    const points: TransferDataPoint[] = rows.map((r) => ({
      timestamp: r.timestamp,
      uploadBytes: r.upload_bytes,
      downloadBytes: r.download_bytes,
      filesTransferred: r.files_transferred,
    }))

    let totalUploadBytes = 0
    let totalDownloadBytes = 0
    let totalFilesTransferred = 0
    let peakUploadBytesPerSec = 0
    let peakDownloadBytesPerSec = 0

    for (const p of points) {
      totalUploadBytes += p.uploadBytes
      totalDownloadBytes += p.downloadBytes
      totalFilesTransferred += p.filesTransferred
      // Per-minute rate → per-sec: divide by 60
      const upPerSec = p.uploadBytes / 60
      const downPerSec = p.downloadBytes / 60
      if (upPerSec > peakUploadBytesPerSec) peakUploadBytesPerSec = upPerSec
      if (downPerSec > peakDownloadBytesPerSec) peakDownloadBytesPerSec = downPerSec
    }

    return {
      points,
      totalUploadBytes,
      totalDownloadBytes,
      totalFilesTransferred,
      peakUploadBytesPerSec: Math.round(peakUploadBytesPerSec),
      peakDownloadBytesPerSec: Math.round(peakDownloadBytesPerSec),
    }
  }

  dispose(): void {
    clearInterval(this.flushTimer)
    this.flush()
  }

  private flush(): void {
    if (this.currentUpload > 0 || this.currentDownload > 0 || this.currentFiles > 0) {
      try {
        this.store.upsertTransferStat(this.currentMinute, this.currentUpload, this.currentDownload, this.currentFiles)
      } catch {
        // DB may be closed during shutdown
      }
      this.currentUpload = 0
      this.currentDownload = 0
      this.currentFiles = 0
    }
  }

  private maybeRotateBucket(): void {
    const now = this.minuteBucket(Date.now())
    if (now !== this.currentMinute) {
      this.flush()
      this.currentMinute = now
    }
  }

  private minuteBucket(ts: number): number {
    return Math.floor(ts / 60000) * 60000
  }
}
