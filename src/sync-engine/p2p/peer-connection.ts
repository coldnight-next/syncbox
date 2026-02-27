import crypto from 'node:crypto'
import { WebSocket } from 'ws'
import type { PeerMessage, HandshakePayload, HandshakeResponsePayload } from '../../shared/types/peer'
import { serializeMessage, deserializeMessage, createMessageId } from './protocol'
import type { Logger } from '../logger'

export interface PeerConnectionOptions {
  ws: WebSocket
  localDeviceId: string
  localPublicKeyHex: string
  localUserId: string
  signFn: (data: Buffer | string) => Buffer
  verifyFn: (data: Buffer | string, signature: Buffer, publicKeyHex: string) => boolean
  logger: Logger
  onAuthenticated: (remoteDeviceId: string) => void
  onMessage: (msg: PeerMessage) => void
  onClose: (remoteDeviceId: string) => void
}

export class PeerConnection {
  private ws: WebSocket
  private options: PeerConnectionOptions
  private authenticated = false
  private remoteDeviceId: string | null = null

  constructor(options: PeerConnectionOptions) {
    this.options = options
    this.ws = options.ws

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = deserializeMessage(data)
        this.handleMessage(msg)
      } catch (err) {
        options.logger.error('Failed to parse peer message', { error: String(err) })
      }
    })

    this.ws.on('close', () => {
      if (this.remoteDeviceId) {
        options.onClose(this.remoteDeviceId)
      }
    })

    this.ws.on('error', (err) => {
      options.logger.error('WebSocket error', { error: String(err) })
    })
  }

  initiateHandshake(): void {
    const challenge = crypto.randomBytes(32).toString('hex')
    const msg: PeerMessage = {
      type: 'handshake',
      id: createMessageId(),
      payload: {
        deviceId: this.options.localDeviceId,
        publicKeyHex: this.options.localPublicKeyHex,
        userId: this.options.localUserId,
        challenge,
      } satisfies HandshakePayload,
    }

    this._pendingChallenge = challenge
    this.send(msg)
  }

  private _pendingChallenge: string | null = null

  send(msg: PeerMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serializeMessage(msg))
    }
  }

  close(): void {
    this.ws.close()
  }

  isAuthenticated(): boolean {
    return this.authenticated
  }

  getRemoteDeviceId(): string | null {
    return this.remoteDeviceId
  }

  private handleMessage(msg: PeerMessage): void {
    if (msg.type === 'handshake') {
      this.handleHandshake(msg.payload as HandshakePayload)
    } else if (msg.type === 'handshake-response') {
      this.handleHandshakeResponse(msg.payload as HandshakeResponsePayload)
    } else if (msg.type === 'ack' && !this.authenticated) {
      // Final ack completes authentication for responder
      this.authenticated = true
      this.options.logger.info('Peer authenticated (responder)', {
        remoteDeviceId: this.remoteDeviceId,
      })
      this.options.onAuthenticated(this.remoteDeviceId!)
    } else if (this.authenticated) {
      this.options.onMessage(msg)
    } else {
      this.options.logger.warn('Received message before authentication', { type: msg.type })
    }
  }

  private handleHandshake(payload: HandshakePayload): void {
    if (payload.userId !== this.options.localUserId) {
      this.options.logger.warn('Handshake from different user, rejecting')
      this.close()
      return
    }

    this.remoteDeviceId = payload.deviceId
    // publicKeyHex stored for future use in encrypted messaging

    // Sign their challenge
    const challengeSignature = this.options.signFn(payload.challenge).toString('base64')
    const counterChallenge = crypto.randomBytes(32).toString('hex')

    const response: PeerMessage = {
      type: 'handshake-response',
      id: createMessageId(),
      payload: {
        deviceId: this.options.localDeviceId,
        publicKeyHex: this.options.localPublicKeyHex,
        userId: this.options.localUserId,
        challengeSignature,
        counterChallenge,
      } satisfies HandshakeResponsePayload,
    }

    this._pendingChallenge = counterChallenge
    this.send(response)
  }

  private handleHandshakeResponse(payload: HandshakeResponsePayload): void {
    if (payload.userId !== this.options.localUserId) {
      this.options.logger.warn('Handshake response from different user')
      this.close()
      return
    }

    this.remoteDeviceId = payload.deviceId
    // publicKeyHex stored for future use in encrypted messaging

    // Verify their signature of our challenge
    if (!this._pendingChallenge) {
      this.options.logger.error('No pending challenge')
      this.close()
      return
    }

    const sigBuffer = Buffer.from(payload.challengeSignature, 'base64')
    const valid = this.options.verifyFn(
      this._pendingChallenge,
      sigBuffer,
      payload.publicKeyHex,
    )

    if (!valid) {
      this.options.logger.error('Handshake signature verification failed')
      this.close()
      return
    }

    // Sign their counter-challenge and send ack
    const counterSig = this.options.signFn(payload.counterChallenge).toString('base64')
    const ack: PeerMessage = {
      type: 'ack',
      id: createMessageId(),
      payload: { counterChallengeSignature: counterSig },
    }
    this.send(ack)

    this.authenticated = true
    this.options.logger.info('Peer authenticated (initiator)', {
      remoteDeviceId: this.remoteDeviceId,
    })
    this.options.onAuthenticated(this.remoteDeviceId)
  }
}
