import crypto from 'node:crypto'
import { shell } from 'electron'
import Store from 'electron-store'
import { createClerkClient } from '@clerk/backend'
import { startCallbackServer } from './callback-server'
import { getDeviceId, getDeviceName } from './device-identity'
import type { AuthState, AuthTokens, AuthEvent, DeviceInfo } from '../../shared/types/auth'
import { AUTH_INITIAL_STATE } from '../../shared/types/auth'
import type { Logger } from '../../sync-engine/logger'

interface AuthStoreSchema {
  tokens?: AuthTokens
  userId?: string
}

export class AuthManager {
  private store: Store<AuthStoreSchema>
  private state: AuthState = { ...AUTH_INITIAL_STATE }
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private logger: Logger
  private clerkClient: ReturnType<typeof createClerkClient>
  private publishableKey: string
  private redirectUri: string
  private eventCallback: (event: AuthEvent) => void
  private stateCallback: (state: AuthState) => void

  constructor(options: {
    publishableKey: string
    secretKey: string
    redirectUri: string
    logger: Logger
    onEvent: (event: AuthEvent) => void
    onStateChange: (state: AuthState) => void
  }) {
    this.store = new Store<AuthStoreSchema>({ name: 'auth', encryptionKey: 'syncbox-auth' })
    this.logger = options.logger
    this.publishableKey = options.publishableKey
    this.redirectUri = options.redirectUri
    this.eventCallback = options.onEvent
    this.stateCallback = options.onStateChange

    this.clerkClient = createClerkClient({ secretKey: options.secretKey })
  }

  async initialize(): Promise<void> {
    const tokens = this.store.get('tokens')
    const userId = this.store.get('userId')

    if (tokens && userId && tokens.expiresAt > Date.now()) {
      this.logger.info('Restoring existing session', { userId })
      await this.loadUserState(userId)
      this.scheduleRefresh(tokens.expiresAt)
    } else if (tokens?.refreshToken && userId) {
      this.logger.info('Tokens expired, attempting refresh')
      try {
        await this.refreshTokens()
      } catch {
        this.logger.warn('Token refresh failed, user must re-authenticate')
        this.clearSession()
      }
    }
  }

  async signIn(): Promise<void> {
    this.logger.info('Starting PKCE sign-in flow')

    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
    const state = crypto.randomBytes(16).toString('hex')

    const callbackPromise = startCallbackServer(state, this.logger)

    // Extract Clerk frontend API from publishable key
    const frontendApi = this.publishableKey.replace('pk_test_', '').replace('pk_live_', '')
    const authorizeUrl = new URL(`https://${frontendApi}/oauth/authorize`)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('redirect_uri', this.redirectUri)
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('state', state)

    await shell.openExternal(authorizeUrl.toString())

    try {
      const { code } = await callbackPromise

      // Exchange code for tokens
      const tokenResponse = await fetch(`https://${frontendApi}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }),
      })

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`)
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string
        refresh_token?: string
        expires_in: number
        user_id: string
      }

      const tokens: AuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      }

      this.store.set('tokens', tokens)
      this.store.set('userId', tokenData.user_id)

      await this.loadUserState(tokenData.user_id)
      await this.registerDevice(tokenData.user_id)
      this.scheduleRefresh(tokens.expiresAt)

      this.eventCallback({ type: 'signed-in', userId: tokenData.user_id })
      this.logger.info('Sign-in complete', { userId: tokenData.user_id })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error('Sign-in failed', { error: msg })
      this.eventCallback({ type: 'auth-error', error: msg })
    }
  }

  async signOut(): Promise<void> {
    this.logger.info('Signing out')
    this.clearSession()
    this.eventCallback({ type: 'signed-out' })
    this.stateCallback(this.state)
  }

  getState(): AuthState {
    return { ...this.state }
  }

  getDeviceId(): string {
    return getDeviceId()
  }

  /** Get the current access token for relay auth. */
  getAccessToken(): string | null {
    const tokens = this.store.get('tokens')
    if (!tokens || tokens.expiresAt <= Date.now()) return null
    return tokens.accessToken
  }

  async getPairedDevices(): Promise<DeviceInfo[]> {
    return this.state.devices
  }

  async pairDevice(deviceId: string): Promise<void> {
    const userId = this.store.get('userId')
    if (!userId) throw new Error('Not authenticated')

    const user = await this.clerkClient.users.getUser(userId)
    const devices = ((user.publicMetadata as Record<string, unknown>).pairedDevices ?? []) as DeviceInfo[]

    if (devices.some((d) => d.deviceId === deviceId)) return

    devices.push({
      deviceId,
      name: `Device ${deviceId.slice(0, 6)}`,
      platform: process.platform,
      lastSeenAt: Date.now(),
      addedAt: Date.now(),
    })

    await this.clerkClient.users.updateUser(userId, {
      publicMetadata: { ...user.publicMetadata, pairedDevices: devices },
    })

    this.state = { ...this.state, devices }
    this.stateCallback(this.state)
  }

  async unpairDevice(deviceId: string): Promise<void> {
    const userId = this.store.get('userId')
    if (!userId) throw new Error('Not authenticated')

    const user = await this.clerkClient.users.getUser(userId)
    const devices = ((user.publicMetadata as Record<string, unknown>).pairedDevices ?? []) as DeviceInfo[]
    const filtered = devices.filter((d) => d.deviceId !== deviceId)

    await this.clerkClient.users.updateUser(userId, {
      publicMetadata: { ...user.publicMetadata, pairedDevices: filtered },
    })

    this.state = { ...this.state, devices: filtered }
    this.stateCallback(this.state)
    this.eventCallback({ type: 'device-unpaired', deviceId })
  }

  async renameDevice(deviceId: string, name: string): Promise<void> {
    const userId = this.store.get('userId')
    if (!userId) throw new Error('Not authenticated')

    const user = await this.clerkClient.users.getUser(userId)
    const devices = ((user.publicMetadata as Record<string, unknown>).pairedDevices ?? []) as DeviceInfo[]
    const device = devices.find((d) => d.deviceId === deviceId)
    if (device) device.name = name

    await this.clerkClient.users.updateUser(userId, {
      publicMetadata: { ...user.publicMetadata, pairedDevices: devices },
    })

    this.state = { ...this.state, devices: [...devices] }
    this.stateCallback(this.state)
  }

  private async loadUserState(userId: string): Promise<void> {
    try {
      const user = await this.clerkClient.users.getUser(userId)
      const email = user.emailAddresses[0]?.emailAddress ?? null
      const devices = ((user.publicMetadata as Record<string, unknown>).pairedDevices ?? []) as DeviceInfo[]

      this.state = {
        isAuthenticated: true,
        userId,
        email,
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || email,
        avatarUrl: user.imageUrl ?? null,
        devices,
      }
      this.stateCallback(this.state)
    } catch (error) {
      this.logger.error('Failed to load user state', { error: String(error) })
    }
  }

  private async registerDevice(userId: string): Promise<void> {
    const deviceId = getDeviceId()
    const user = await this.clerkClient.users.getUser(userId)
    const devices = ((user.publicMetadata as Record<string, unknown>).pairedDevices ?? []) as DeviceInfo[]

    const existing = devices.find((d) => d.deviceId === deviceId)
    if (existing) {
      existing.lastSeenAt = Date.now()
    } else {
      devices.push({
        deviceId,
        name: getDeviceName(),
        platform: process.platform,
        lastSeenAt: Date.now(),
        addedAt: Date.now(),
      })
    }

    await this.clerkClient.users.updateUser(userId, {
      publicMetadata: { ...user.publicMetadata, pairedDevices: devices },
    })

    this.state = { ...this.state, devices }
    this.stateCallback(this.state)
    this.eventCallback({ type: 'device-paired', device: devices.find((d) => d.deviceId === deviceId)! })
  }

  private async refreshTokens(): Promise<void> {
    const tokens = this.store.get('tokens')
    if (!tokens?.refreshToken) throw new Error('No refresh token')

    const frontendApi = this.publishableKey.replace('pk_test_', '').replace('pk_live_', '')
    const resp = await fetch(`https://${frontendApi}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }),
    })

    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`)

    const data = (await resp.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    const newTokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    this.store.set('tokens', newTokens)
    this.scheduleRefresh(newTokens.expiresAt)
    this.eventCallback({ type: 'token-refreshed' })
    this.logger.debug('Tokens refreshed')
  }

  private scheduleRefresh(expiresAt: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    // Refresh 5 minutes before expiry
    const refreshIn = Math.max(0, expiresAt - Date.now() - 5 * 60 * 1000)
    this.refreshTimer = setTimeout(() => {
      void this.refreshTokens().catch((err) => {
        this.logger.error('Auto-refresh failed', { error: String(err) })
      })
    }, refreshIn)
  }

  private clearSession(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.store.delete('tokens')
    this.store.delete('userId')
    this.state = { ...AUTH_INITIAL_STATE }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}
