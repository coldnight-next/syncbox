import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { SyncStatus } from '@shared/types/sync'

interface FolderPickerProps {
  status: SyncStatus
}

export function FolderPicker({ status }: FolderPickerProps): React.JSX.Element {
  const [folders, setFolders] = useState<string[]>([])

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

  const stateLabel =
    status.state === 'syncing'
      ? 'Syncing'
      : status.state === 'paused'
        ? 'Paused'
        : status.state === 'error'
          ? 'Error'
          : 'Watching'

  const stateColor =
    status.state === 'syncing'
      ? 'text-blue-600'
      : status.state === 'error'
        ? 'text-red-600'
        : status.state === 'paused'
          ? 'text-yellow-600'
          : 'text-green-600'

  const stateDot =
    status.state === 'syncing'
      ? 'bg-blue-500 animate-pulse'
      : status.state === 'error'
        ? 'bg-red-500'
        : status.state === 'paused'
          ? 'bg-yellow-500'
          : 'bg-green-500'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Sync Folders</h2>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${stateDot}`} />
          <span className={`text-sm font-medium ${stateColor}`}>{stateLabel}</span>
        </div>
      </div>

      {folders.length > 0 ? (
        <ul className="space-y-2">
          {folders.map((folder) => (
            <li
              key={folder}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <svg className="h-5 w-5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <span className="truncate font-mono text-sm text-gray-700" title={folder}>
                  {folder}
                </span>
              </div>
              <button
                onClick={() => void handleRemoveFolder(folder)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Remove folder"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No folders synced yet. Add a folder to start syncing.</p>
      )}

      <button
        onClick={() => void handleAddFolder()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Folder
      </button>
    </div>
  )
}
