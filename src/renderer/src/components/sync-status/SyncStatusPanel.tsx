import type { SyncStatus } from '@shared/types/sync'
import { ProgressBar } from '../ui/ProgressBar'
import { formatBytes, formatSpeed } from '@shared/utils/format'

interface SyncStatusPanelProps {
  status: SyncStatus
}

export function SyncStatusPanel({ status }: SyncStatusPanelProps): React.JSX.Element {
  const isSyncing = status.state === 'syncing'
  const hasJobs = status.totalJobs > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-medium text-gray-900">Sync Status</h2>

      {/* Status indicator */}
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${
            status.state === 'syncing'
              ? 'animate-pulse bg-syncbox-500'
              : status.state === 'error'
                ? 'bg-red-500'
                : status.state === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
          }`}
        />
        <span className="text-sm font-medium capitalize text-gray-700">{status.state}</span>
      </div>

      {/* Progress */}
      {hasJobs && (
        <div className="mb-4">
          <ProgressBar value={status.completedJobs} max={status.totalJobs} showLabel />
          <div className="mt-1 text-xs text-gray-500">
            {status.completedJobs} / {status.totalJobs} files
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Pending</span>
          <p className="font-medium">{status.pendingJobs}</p>
        </div>
        <div>
          <span className="text-gray-500">Active</span>
          <p className="font-medium">{status.activeJobs}</p>
        </div>
        <div>
          <span className="text-gray-500">Failed</span>
          <p className="font-medium text-red-600">{status.failedJobs}</p>
        </div>
        <div>
          <span className="text-gray-500">Transferred</span>
          <p className="font-medium">{formatBytes(status.transferredBytes)}</p>
        </div>
      </div>

      {/* Speed */}
      {isSyncing && status.throughputBytesPerSec > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
          Speed: {formatSpeed(status.throughputBytesPerSec)}
        </div>
      )}
    </div>
  )
}
