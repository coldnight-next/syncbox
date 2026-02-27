import { useEffect } from 'react'
import { useSyncStore } from '../stores/sync-store'
import { ipc } from '../lib/ipc-client'

export function useSyncStatus() {
  const status = useSyncStore((state) => state.status)
  const setStatus = useSyncStore((state) => state.setStatus)

  useEffect(() => {
    // Fetch initial status
    void ipc.invoke('sync:get-status').then(setStatus)

    // Subscribe to status updates
    const unsubscribe = ipc.on('sync:status', (newStatus) => {
      setStatus(newStatus)
    })

    return unsubscribe
  }, [setStatus])

  return {
    status,
    isConnected: status.state !== 'offline',
  }
}
