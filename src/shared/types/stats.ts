export interface TransferDataPoint {
  timestamp: number
  uploadBytes: number
  downloadBytes: number
  filesTransferred: number
}

export interface TransferStats {
  points: TransferDataPoint[]
  totalUploadBytes: number
  totalDownloadBytes: number
  totalFilesTransferred: number
  peakUploadBytesPerSec: number
  peakDownloadBytesPerSec: number
}

export type StatsTimeRange = 'day' | 'week' | 'month'
