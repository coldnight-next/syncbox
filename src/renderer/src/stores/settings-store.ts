import { create } from 'zustand'
import type { AppConfig } from '@shared/types/config'

interface SettingsStore {
  config: AppConfig
  setConfig: (config: AppConfig) => void
  updateConfig: (partial: Partial<AppConfig>) => void
}

const defaultConfig: AppConfig = {
  syncFolder: '',
  maxConcurrentTransfers: 4,
  conflictStrategy: 'ask',
  enableNotifications: true,
  autoStart: false,
  theme: 'system',
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  config: defaultConfig,
  setConfig: (config) => set({ config }),
  updateConfig: (partial) => set((state) => ({ config: { ...state.config, ...partial } })),
}))
