import type { ConflictInfo, ConflictResolution } from '@shared/types/sync'
import { Button } from '../ui/Button'
import { ipc } from '../../lib/ipc-client'
import { useCallback } from 'react'

interface ConflictPanelProps {
  conflicts: ConflictInfo[]
}

export function ConflictPanel({ conflicts }: ConflictPanelProps): React.JSX.Element | null {
  const handleResolve = useCallback((id: string, resolution: ConflictResolution) => {
    void ipc.invoke('sync:resolve-conflict', id, resolution)
  }, [])

  if (conflicts.length === 0) return null

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-yellow-800">
        Conflicts ({conflicts.length})
      </h3>
      <ul className="space-y-3">
        {conflicts.map((conflict) => (
          <li key={conflict.id} className="rounded border border-yellow-100 bg-white p-3">
            <div className="mb-2 text-sm font-medium text-gray-800">
              {conflict.relativePath || conflict.filePath}
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Type: {conflict.conflictType} &middot; Detected{' '}
              {new Date(conflict.detectedAt).toLocaleString()}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => handleResolve(conflict.id, 'keep-local')}>
                Keep Local
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleResolve(conflict.id, 'keep-remote')}>
                Keep Remote
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleResolve(conflict.id, 'keep-both')}>
                Keep Both
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleResolve(conflict.id, 'skip')}>
                Skip
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
