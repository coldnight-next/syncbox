import crypto from 'node:crypto'
import os from 'node:os'
import Store from 'electron-store'

interface StoredKeyPair {
  publicKey: string
  privateKey: string
}

const store = new Store<{ deviceKeyPair?: StoredKeyPair; deviceName?: string }>({
  name: 'device-identity',
  encryptionKey: 'syncbox-device-key',
})

let cachedKeyPair: crypto.KeyPairKeyObjectResult | null = null

function loadOrCreateKeyPair(): crypto.KeyPairKeyObjectResult {
  if (cachedKeyPair) return cachedKeyPair

  const stored = store.get('deviceKeyPair')
  if (stored) {
    cachedKeyPair = {
      publicKey: crypto.createPublicKey({
        key: Buffer.from(stored.publicKey, 'hex'),
        format: 'der',
        type: 'spki',
      }),
      privateKey: crypto.createPrivateKey({
        key: Buffer.from(stored.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8',
      }),
    }
    return cachedKeyPair
  }

  const keyPair = crypto.generateKeyPairSync('ed25519')

  const pubDer = keyPair.publicKey.export({ format: 'der', type: 'spki' })
  const privDer = keyPair.privateKey.export({ format: 'der', type: 'pkcs8' })

  store.set('deviceKeyPair', {
    publicKey: Buffer.from(pubDer).toString('hex'),
    privateKey: Buffer.from(privDer).toString('hex'),
  })

  cachedKeyPair = keyPair
  return keyPair
}

export function getDeviceId(): string {
  const { publicKey } = loadOrCreateKeyPair()
  const raw = publicKey.export({ format: 'der', type: 'spki' })
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export function getPublicKeyHex(): string {
  const { publicKey } = loadOrCreateKeyPair()
  const raw = publicKey.export({ format: 'der', type: 'spki' })
  return Buffer.from(raw).toString('hex')
}

export function sign(data: Buffer | string): Buffer {
  const { privateKey } = loadOrCreateKeyPair()
  return crypto.sign(null, Buffer.from(data), privateKey)
}

export function verifySignature(
  data: Buffer | string,
  signature: Buffer,
  publicKeyHex: string,
): boolean {
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyHex, 'hex'),
    format: 'der',
    type: 'spki',
  })
  return crypto.verify(null, Buffer.from(data), publicKey, signature)
}

export function getDeviceName(): string {
  return store.get('deviceName') || os.hostname()
}

export function setDeviceName(name: string): void {
  store.set('deviceName', name)
}
