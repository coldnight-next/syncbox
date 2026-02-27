export type FileSystemEventType = 'create' | 'modify' | 'delete' | 'rename' | 'noop'

export interface FileSystemEvent {
  type: FileSystemEventType
  path: string
  timestamp: number
  oldPath?: string
}

export type EngineEvent =
  | { type: 'engine:started' }
  | { type: 'engine:stopped' }
  | { type: 'engine:paused' }
  | { type: 'engine:resumed' }
  | { type: 'engine:error'; error: string }
  | { type: 'watcher:ready' }
  | { type: 'watcher:error'; error: string }
