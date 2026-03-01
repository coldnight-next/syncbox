import type { SyncStatus, SyncEvent, ConflictInfo, ConflictResolution, FolderStats } from './sync'
import type { AppConfig } from './config'
import type { StructuredLogEntry } from './logging'
import type { AuthState, AuthEvent, DeviceInfo } from './auth'
import type { PeerInfo, PeerEvent } from './peer'
import type { TransferStats, TransferDataPoint, StatsTimeRange } from './stats'

export interface IpcMainHandlers {
  // Sync
  'sync:start': { params: []; return: void }
  'sync:stop': { params: []; return: void }
  'sync:force': { params: [filePath?: string]; return: void }
  'sync:get-status': { params: []; return: SyncStatus }
  'sync:get-conflicts': { params: []; return: ConflictInfo[] }
  'sync:resolve-conflict': {
    params: [id: string, resolution: ConflictResolution]
    return: void
  }
  'sync:set-folder': { params: [folderPath: string]; return: void }
  'sync:get-folder': { params: []; return: string | null }
  'sync:add-folder': { params: [folderPath: string]; return: void }
  'sync:remove-folder': { params: [folderPath: string]; return: void }
  'sync:get-folders': { params: []; return: string[] }
  'sync:get-folder-stats': { params: [folderPath: string]; return: FolderStats }

  // Config
  'config:get': { params: []; return: AppConfig }
  'config:set': { params: [config: Partial<AppConfig>]; return: void }
  'dialog:select-folder': { params: []; return: string | null }

  // Logging
  'log:write': { params: [entry: StructuredLogEntry]; return: void }

  // Auth
  'auth:sign-in': { params: []; return: void }
  'auth:sign-out': { params: []; return: void }
  'auth:set-user': { params: [userId: string]; return: void }
  'auth:get-state': { params: []; return: AuthState }
  'auth:refresh': { params: []; return: void }
  'auth:get-device-id': { params: []; return: string }

  // Devices
  'device:pair': { params: [deviceId: string]; return: void }
  'device:unpair': { params: [deviceId: string]; return: void }
  'device:get-paired': { params: []; return: DeviceInfo[] }
  'device:rename': { params: [deviceId: string, name: string]; return: void }

  // Peers
  'peer:get-discovered': { params: []; return: PeerInfo[] }
  'peer:connect': { params: [deviceId: string]; return: void }
  'peer:disconnect': { params: [deviceId: string]; return: void }
  'peer:get-connected': { params: []; return: PeerInfo[] }

  // Stats
  'stats:get': { params: [range: StatsTimeRange]; return: TransferStats }
  'stats:get-realtime': { params: []; return: TransferDataPoint }

  // Updates
  'update:check': { params: []; return: void }
  'update:download': { params: []; return: void }
  'update:install': { params: []; return: void }
}

export interface IpcRendererEvents {
  'sync:status': SyncStatus
  'sync:event': SyncEvent
  'sync:progress': { filePath: string; percent: number }
  'sync:folders-changed': string[]
  'auth:state-changed': AuthState
  'auth:event': AuthEvent
  'peer:event': PeerEvent
  'peer:list-updated': PeerInfo[]
  'stats:realtime-update': TransferDataPoint
  'update:available': { version: string; releaseNotes?: string }
  'update:not-available': { version: string }
  'update:progress': { percent: number; bytesPerSecond: number; transferred: number; total: number }
  'update:downloaded': Record<string, never>
  'update:error': { message: string }
}

export type IpcChannel = keyof IpcMainHandlers
export type IpcParams<C extends IpcChannel> = IpcMainHandlers[C]['params']
export type IpcReturn<C extends IpcChannel> = IpcMainHandlers[C]['return']
