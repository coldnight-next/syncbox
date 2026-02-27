import { create } from 'zustand'
import type { PeerInfo } from '@shared/types/peer'

interface PeerStore {
  discoveredPeers: PeerInfo[]
  connectedPeers: PeerInfo[]
  setDiscoveredPeers: (peers: PeerInfo[]) => void
  setConnectedPeers: (peers: PeerInfo[]) => void
}

export const usePeerStore = create<PeerStore>((set) => ({
  discoveredPeers: [],
  connectedPeers: [],
  setDiscoveredPeers: (peers) => set({ discoveredPeers: peers }),
  setConnectedPeers: (peers) => set({ connectedPeers: peers }),
}))
