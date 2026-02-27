import { useEffect } from 'react'
import { usePeerStore } from '../stores/peer-store'
import { ipc } from '../lib/ipc-client'

export function usePeers() {
  const discoveredPeers = usePeerStore((s) => s.discoveredPeers)
  const connectedPeers = usePeerStore((s) => s.connectedPeers)
  const setDiscoveredPeers = usePeerStore((s) => s.setDiscoveredPeers)
  const setConnectedPeers = usePeerStore((s) => s.setConnectedPeers)

  useEffect(() => {
    void ipc.invoke('peer:get-discovered').then(setDiscoveredPeers)
    void ipc.invoke('peer:get-connected').then(setConnectedPeers)

    const unsubList = ipc.on('peer:list-updated', (peers) => {
      setDiscoveredPeers(peers)
    })

    const unsubEvent = ipc.on('peer:event', (event) => {
      if (event.type === 'peer-connected' || event.type === 'peer-disconnected') {
        void ipc.invoke('peer:get-connected').then(setConnectedPeers)
      }
    })

    return () => {
      unsubList()
      unsubEvent()
    }
  }, [setDiscoveredPeers, setConnectedPeers])

  return { discoveredPeers, connectedPeers }
}
