export interface DeviceInfo {
  deviceId: string
  name: string
  platform: string
  lastSeenAt: number
  addedAt: number
}

export interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  devices: DeviceInfo[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

export type AuthEvent =
  | { type: 'signed-in'; userId: string }
  | { type: 'signed-out' }
  | { type: 'token-refreshed' }
  | { type: 'device-paired'; device: DeviceInfo }
  | { type: 'device-unpaired'; deviceId: string }
  | { type: 'auth-error'; error: string }

export const AUTH_INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  displayName: null,
  avatarUrl: null,
  devices: [],
}
