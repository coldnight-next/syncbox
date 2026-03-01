import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

export interface FolderState {
  version: 1
  deviceId: string
  lastSyncedAt: number
  manifestHash: string
  fileCount: number
}

/**
 * Compute a deterministic SHA-256 hash from file entries.
 * Sorts by relativePath so the hash is identical regardless of scan order.
 */
export function computeManifestHash(entries: Array<{ relativePath: string; checksum: string }>): string {
  const sorted = [...entries].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  const content = sorted.map((e) => `${e.relativePath}:${e.checksum}\n`).join('')
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Read `.syncbox/state.json` from a folder. Returns undefined if missing or corrupt.
 */
export function readFolderState(folderPath: string): FolderState | undefined {
  try {
    const statePath = path.join(folderPath, '.syncbox', 'state.json')
    const raw = fs.readFileSync(statePath, 'utf-8')
    const parsed = JSON.parse(raw) as FolderState
    if (parsed.version !== 1 || typeof parsed.manifestHash !== 'string') {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

/**
 * Write `.syncbox/state.json` synchronously (tiny file, avoids race conditions).
 * Creates the `.syncbox/` directory if needed.
 */
export function writeFolderState(folderPath: string, state: FolderState): void {
  const syncboxDir = path.join(folderPath, '.syncbox')
  fs.mkdirSync(syncboxDir, { recursive: true })
  const statePath = path.join(syncboxDir, 'state.json')
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
}
