import type { SyncStatus, ConflictInfo, ConflictResolution } from '@shared/types/sync'
import { formatBytes, formatSpeed } from '@shared/utils/format'
import { ipc } from '../../lib/ipc-client'
import { useCallback } from 'react'

interface ActivityPageProps {
  status: SyncStatus
  conflicts: ConflictInfo[]
}

export function ActivityPage({ status, conflicts }: ActivityPageProps): React.JSX.Element {
  const handleResolve = useCallback((id: string, resolution: ConflictResolution) => {
    void ipc.invoke('sync:resolve-conflict', id, resolution)
  }, [])

  const isSyncing = status.state === 'syncing'

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold text-gray-900">Activity</h1>
        <p className="mt-0.5 text-sm text-gray-500">Sync progress and conflict resolution</p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* Status card */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isSyncing ? 'bg-blue-50 text-blue-600' :
              status.state === 'error' ? 'bg-red-50 text-red-600' :
              status.state === 'paused' ? 'bg-amber-50 text-amber-600' :
              'bg-emerald-50 text-emerald-600'
            }`}>
              {isSyncing ? (
                <svg className="h-5 w-5 animate-sync-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {isSyncing ? 'Syncing files...' :
                 status.state === 'paused' ? 'Sync paused' :
                 status.state === 'error' ? 'Sync error' :
                 'Everything is up to date'}
              </h2>
              <p className="text-xs text-gray-500">
                {isSyncing && status.throughputBytesPerSec > 0
                  ? `${formatSpeed(status.throughputBytesPerSec)}`
                  : `${formatBytes(status.transferredBytes)} transferred`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {status.totalJobs > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{status.completedJobs} of {status.totalJobs} files</span>
                <span>{Math.round((status.completedJobs / status.totalJobs) * 100)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-blue-400 transition-all duration-500"
                  style={{ width: `${(status.completedJobs / status.totalJobs) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-4 gap-4">
            <StatCard label="Completed" value={status.completedJobs} />
            <StatCard label="Active" value={status.activeJobs} />
            <StatCard label="Pending" value={status.pendingJobs} />
            <StatCard label="Failed" value={status.failedJobs} color={status.failedJobs > 0 ? 'text-red-600' : undefined} />
          </div>
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h2 className="text-sm font-semibold text-amber-900">
                {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''}
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="rounded-lg border border-amber-100 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {conflict.relativePath || conflict.filePath}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {conflict.conflictType} conflict &middot; {new Date(conflict.detectedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <ActionButton label="Keep Local" onClick={() => handleResolve(conflict.id, 'keep-local')} variant="primary" />
                    <ActionButton label="Keep Remote" onClick={() => handleResolve(conflict.id, 'keep-remote')} />
                    <ActionButton label="Keep Both" onClick={() => handleResolve(conflict.id, 'keep-both')} />
                    <ActionButton label="Skip" onClick={() => handleResolve(conflict.id, 'skip')} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for no activity */}
        {status.totalJobs === 0 && conflicts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <svg className="h-7 w-7 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-900">No recent activity</p>
            <p className="mt-1 text-xs text-gray-500">Your files are all synced up</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-3 py-2.5 text-center">
      <p className={`text-lg font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  )
}

function ActionButton({ label, onClick, variant }: { label: string; onClick: () => void; variant?: 'primary' }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        variant === 'primary'
          ? 'bg-accent text-white hover:bg-blue-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
