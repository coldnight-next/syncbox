import { create } from 'zustand'
import { useEffect } from 'react'
import type { TransferStats, TransferDataPoint, StatsTimeRange } from '@shared/types/stats'
import { ipc } from '../lib/ipc-client'

interface StatsStore {
  stats: Record<StatsTimeRange, TransferStats | null>
  realtimePoint: TransferDataPoint | null
  loading: boolean
  fetchStats: (range: StatsTimeRange) => Promise<void>
}

const useStatsStore = create<StatsStore>((set, _get) => ({
  stats: { day: null, week: null, month: null },
  realtimePoint: null,
  loading: false,
  fetchStats: async (range) => {
    set({ loading: true })
    const data = await ipc.invoke('stats:get', range)
    set((s) => ({
      stats: { ...s.stats, [range]: data },
      loading: false,
    }))
  },
}))

export function useStats(range: StatsTimeRange): {
  stats: TransferStats | null
  realtimePoint: TransferDataPoint | null
  loading: boolean
} {
  const stats = useStatsStore((s) => s.stats[range])
  const realtimePoint = useStatsStore((s) => s.realtimePoint)
  const loading = useStatsStore((s) => s.loading)
  const fetchStats = useStatsStore((s) => s.fetchStats)

  useEffect(() => {
    void fetchStats(range)
  }, [range, fetchStats])

  useEffect(() => {
    const unsub = ipc.on('stats:realtime-update', (point) => {
      useStatsStore.setState({ realtimePoint: point })
    })
    return unsub
  }, [])

  return { stats, realtimePoint, loading }
}
