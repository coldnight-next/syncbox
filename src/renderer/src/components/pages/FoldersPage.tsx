import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { SyncStatus } from '@shared/types/sync'
import { formatBytes } from '@shared/utils/format'

interface FoldersPageProps {
  status: SyncStatus
}

export function FoldersPage({ status }: FoldersPageProps): React.JSX.Element {
  const [folders, setFolders] = useState<string[]>([])
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)

  const refreshFolders = useCallback(() => {
    void ipc.invoke('sync:get-folders').then(setFolders)
  }, [])

  useEffect(() => {
    refreshFolders()
  }, [refreshFolders])

  async function handleAddFolder(): Promise<void> {
    const selected = await ipc.invoke('dialog:select-folder')
    if (selected) {
      await ipc.invoke('sync:add-folder', selected)
      refreshFolders()
    }
  }

  async function handleRemoveFolder(folderPath: string): Promise<void> {
    await ipc.invoke('sync:remove-folder', folderPath)
    refreshFolders()
  }

  const isSyncing = status.state === 'syncing'

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Sync Folders</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {folders.length === 0
              ? 'Add folders to start syncing across your devices'
              : `${folders.length} folder${folders.length !== 1 ? 's' : ''} synced`}
          </p>
        </div>
        <button
          onClick={() => void handleAddFolder()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Folder
        </button>
      </div>

      {/* Stats bar */}
      {folders.length > 0 && (
        <div className="flex gap-6 border-b border-border-light bg-surface-secondary px-8 py-3">
          <Stat label="Status" value={isSyncing ? 'Syncing' : status.state === 'paused' ? 'Paused' : 'Watching'} color={isSyncing ? 'text-blue-600' : 'text-emerald-600'} />
          <Stat label="Transferred" value={formatBytes(status.transferredBytes)} />
          <Stat label="Active" value={String(status.activeJobs)} />
          {status.failedJobs > 0 && <Stat label="Failed" value={String(status.failedJobs)} color="text-red-600" />}
        </div>
      )}

      {/* Folder list */}
      <div className="flex-1 overflow-auto p-8">
        {folders.length === 0 ? (
          <EmptyState onAdd={() => void handleAddFolder()} />
        ) : (
          <div className="space-y-3">
            {folders.map((folder) => {
              const folderName = folder.split(/[\\/]/).pop() ?? folder
              const parentPath = folder.slice(0, folder.length - folderName.length - 1)
              const isHovered = hoveredFolder === folder

              return (
                <div
                  key={folder}
                  className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                    isHovered
                      ? 'border-accent/30 bg-accent-light/30 shadow-md shadow-accent/5'
                      : 'border-border bg-surface hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onMouseEnter={() => setHoveredFolder(folder)}
                  onMouseLeave={() => setHoveredFolder(null)}
                >
                  {/* Sync progress indicator bar */}
                  {isSyncing && (
                    <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-blue-100">
                      <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
                    </div>
                  )}

                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Folder icon */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isHovered ? 'bg-accent text-white' : 'bg-blue-50 text-accent'
                    }`}>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
                      </svg>
                    </div>

                    {/* Folder info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-gray-900">{folderName}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isSyncing
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'animate-pulse bg-blue-500' : 'bg-emerald-500'}`} />
                          {isSyncing ? 'Syncing' : 'Synced'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-400" title={folder}>
                        {parentPath}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                      <button
                        onClick={() => void handleRemoveFolder(folder)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="Remove folder"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Add more folder card */}
            <button
              onClick={() => void handleAddFolder()}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 px-5 py-4 transition-all hover:border-accent/40 hover:bg-accent-light/20"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-500">Add another folder</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
        <svg className="h-10 w-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <h2 className="mt-5 text-base font-semibold text-gray-900">No folders added yet</h2>
      <p className="mt-1.5 max-w-xs text-center text-sm text-gray-500">
        Choose folders on your computer to keep synced across all your devices.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow active:scale-[0.98]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Choose a Folder
      </button>
    </div>
  )
}
