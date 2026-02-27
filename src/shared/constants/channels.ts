export const IPC_CHANNELS = {
  // Sync
  SYNC_START: 'sync:start',
  SYNC_STOP: 'sync:stop',
  SYNC_FORCE: 'sync:force',
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_GET_CONFLICTS: 'sync:get-conflicts',
  SYNC_RESOLVE_CONFLICT: 'sync:resolve-conflict',
  SYNC_SET_FOLDER: 'sync:set-folder',
  SYNC_GET_FOLDER: 'sync:get-folder',
  SYNC_ADD_FOLDER: 'sync:add-folder',
  SYNC_REMOVE_FOLDER: 'sync:remove-folder',
  SYNC_GET_FOLDERS: 'sync:get-folders',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',

  // Logging
  LOG_WRITE: 'log:write',

  // Auth
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_SET_USER: 'auth:set-user',
  AUTH_GET_STATE: 'auth:get-state',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_GET_DEVICE_ID: 'auth:get-device-id',

  // Devices
  DEVICE_PAIR: 'device:pair',
  DEVICE_UNPAIR: 'device:unpair',
  DEVICE_GET_PAIRED: 'device:get-paired',
  DEVICE_RENAME: 'device:rename',

  // Peers
  PEER_GET_DISCOVERED: 'peer:get-discovered',
  PEER_CONNECT: 'peer:connect',
  PEER_DISCONNECT: 'peer:disconnect',
  PEER_GET_CONNECTED: 'peer:get-connected',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
} as const

export const IPC_EVENTS = {
  SYNC_STATUS: 'sync:status',
  SYNC_EVENT: 'sync:event',
  SYNC_PROGRESS: 'sync:progress',
  AUTH_STATE_CHANGED: 'auth:state-changed',
  AUTH_EVENT: 'auth:event',
  PEER_EVENT: 'peer:event',
  PEER_LIST_UPDATED: 'peer:list-updated',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_PROGRESS: 'update:progress',
  UPDATE_DOWNLOADED: 'update:downloaded',
} as const
