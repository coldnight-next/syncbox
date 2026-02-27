import { create } from 'zustand'
import type { SyncStatus, ConflictInfo } from '@shared/types/sync'

interface SyncStore {
  status: SyncStatus
  conflicts: ConflictInfo[]
  setStatus: (status: SyncStatus) => void
  setConflicts: (conflicts: ConflictInfo[]) => void
}

const initialStatus: SyncStatus = {
  state: 'idle',
  totalJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  activeJobs: 0,
  pendingJobs: 0,
  totalBytes: 0,
  transferredBytes: 0,
  estimatedTimeRemainingMs: 0,
  throughputBytesPerSec: 0,
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: initialStatus,
  conflicts: [],
  setStatus: (status) => set({ status }),
  setConflicts: (conflicts) => set({ conflicts }),
}))
