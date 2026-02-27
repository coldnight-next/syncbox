import { sep, posix } from 'path'

/**
 * Normalize a file path to use forward slashes for cross-platform consistency.
 */
export function normalizePath(filePath: string): string {
  return filePath.split(sep).join(posix.sep)
}

/**
 * Get the relative path from a sync root, normalized with forward slashes.
 */
export function relativeSyncPath(filePath: string, syncRoot: string): string {
  const normalized = normalizePath(filePath)
  const normalizedRoot = normalizePath(syncRoot).replace(/\/$/, '')
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.slice(normalizedRoot.length).replace(/^\//, '')
  }
  return normalized
}

/**
 * Check if a path is inside a given root directory.
 */
export function isInsideDirectory(filePath: string, directory: string): boolean {
  const normalized = normalizePath(filePath)
  const normalizedDir = normalizePath(directory).replace(/\/$/, '') + '/'
  return normalized.startsWith(normalizedDir) || normalized === normalizedDir.slice(0, -1)
}
