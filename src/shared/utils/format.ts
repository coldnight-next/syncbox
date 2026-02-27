/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(decimals)} ${sizes[i]}`
}

/**
 * Format milliseconds into a human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return 'less than a second'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format a transfer speed in bytes/second to a readable string.
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

/**
 * Truncate a file path for display, keeping the filename and some parent dirs.
 */
export function truncatePath(filePath: string, maxLength = 50): string {
  if (filePath.length <= maxLength) return filePath
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1]
  if (fileName.length >= maxLength - 3) return `...${fileName.slice(-(maxLength - 3))}`
  let result = fileName
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = `${parts[i]}/${result}`
    if (next.length + 3 > maxLength) break
    result = next
  }
  return `.../${result}`
}
