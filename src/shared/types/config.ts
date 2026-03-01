export type BandwidthPreset = 'no-limit' | 'auto' | 'custom'

export interface AppConfig {
  syncFolder: string
  maxConcurrentTransfers: number
  conflictStrategy: 'ask' | 'keep-both' | 'keep-newest'
  enableNotifications: boolean
  autoStart: boolean
  theme: 'light' | 'dark' | 'system'
  bandwidthPreset: BandwidthPreset
  customUploadKBps: number
  customDownloadKBps: number
  relayUrl: string
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  syncFolder: '',
  maxConcurrentTransfers: 4,
  conflictStrategy: 'keep-newest',
  enableNotifications: true,
  autoStart: false,
  theme: 'system',
  bandwidthPreset: 'no-limit',
  customUploadKBps: 0,
  customDownloadKBps: 0,
  relayUrl: '',
}

export interface RendererEnv {
  VITE_APP_NAME: string
  VITE_API_BASE_URL: string
  VITE_LOG_LEVEL: string
  VITE_ENABLE_DEVTOOLS: string
}

export interface MainEnv {
  MAIN_API_BASE_URL: string
  MAIN_LOG_LEVEL: string
  MAIN_AUTO_UPDATE: string
  MAIN_CLERK_PUBLISHABLE_KEY: string
  MAIN_CLERK_SECRET_KEY: string
  MAIN_CLERK_REDIRECT_URI: string
}
