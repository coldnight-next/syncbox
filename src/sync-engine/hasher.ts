import { createReadStream } from 'fs'
import { createHash } from 'crypto'

/**
 * Compute a SHA-256 hash of a file for integrity verification.
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Compute a fast hash (xxhash) for change detection.
 * Falls back to SHA-256 until xxhash-wasm is initialized.
 */
export async function fastHash(filePath: string): Promise<string> {
  // TODO: integrate xxhash-wasm for faster hashing
  // For now, fall back to SHA-256
  return hashFile(filePath)
}
