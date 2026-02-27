/**
 * Validate that a sync folder path is reasonable.
 */
export function isValidSyncFolder(folderPath: string): boolean {
  if (!folderPath || folderPath.trim().length === 0) return false
  if (folderPath.length > 1024) return false

  // Reject system root paths
  const normalized = folderPath.replace(/[\\/]+$/, '') || '/'
  const dangerous = ['/', 'C:', '/usr', '/etc', '/System', '/Windows']
  if (dangerous.includes(normalized)) return false

  return true
}

/**
 * Validate a conflict resolution choice.
 */
export function isValidConflictResolution(
  resolution: string,
): resolution is 'keep-local' | 'keep-remote' | 'keep-both' | 'skip' {
  return ['keep-local', 'keep-remote', 'keep-both', 'skip'].includes(resolution)
}

/**
 * Validate a theme setting.
 */
export function isValidTheme(theme: string): theme is 'light' | 'dark' | 'system' {
  return ['light', 'dark', 'system'].includes(theme)
}

/**
 * Validate concurrency limits.
 */
export function isValidConcurrency(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 32
}
