import { create } from 'zustand'
import type { AppConfig } from '@shared/types/config'
import { ipc } from '../lib/ipc-client'

interface SettingsStore {
  config: AppConfig | null
  loading: boolean
  loadConfig: () => Promise<void>
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  config: null,
  loading: false,
  loadConfig: async () => {
    if (get().config !== null) return
    set({ loading: true })
    const config = await ipc.invoke('config:get')
    set({ config, loading: false })
  },
  updateConfig: async (partial) => {
    const current = get().config
    if (!current) return
    const updated = { ...current, ...partial }
    set({ config: updated })
    await ipc.invoke('config:set', updated)
  },
}))
