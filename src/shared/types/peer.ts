export interface PeerInfo {
  deviceId: string
  name: string
  host: string
  port: number
  userId: string
  connectionType?: 'lan' | 'relay'
}

export type PeerEvent =
  | { type: 'peer-discovered'; peer: PeerInfo }
  | { type: 'peer-lost'; deviceId: string }
  | { type: 'peer-connected'; deviceId: string }
  | { type: 'peer-disconnected'; deviceId: string }
  | { type: 'peer-authenticated'; deviceId: string }
  | { type: 'peer-error'; deviceId: string; error: string }

export type PeerMessageType =
  | 'handshake'
  | 'handshake-response'
  | 'manifest'
  | 'manifest-diff'
  | 'file-request'
  | 'file-data'
  | 'file-data-end'
  | 'ack'
  | 'folder-config'
  | 'relay:peer-joined'
  | 'relay:peer-left'

export interface FolderConfigPayload {
  folders: string[]
  action: 'full-sync' | 'add' | 'remove'
}

export interface PeerMessage {
  type: PeerMessageType
  id: string
  payload: unknown
}

export interface HandshakePayload {
  deviceId: string
  publicKeyHex: string
  userId: string
  challenge: string
}

export interface HandshakeResponsePayload {
  deviceId: string
  publicKeyHex: string
  userId: string
  challengeSignature: string
  counterChallenge: string
}

export type VectorClock = Record<string, number>

export interface FileManifestEntry {
  relativePath: string
  size: number
  modifiedAt: number
  checksum: string
  clock: VectorClock
  syncRoot?: string
}
