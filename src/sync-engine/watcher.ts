import { watch, type FSWatcher } from 'chokidar'
import type { FileSystemEvent } from '../shared/types/events'

export interface WatcherOptions {
  paths: string[]
  ignoredPatterns: string[]
  onEvent: (event: FileSystemEvent) => void
  onReady: () => void
  onError: (error: Error) => void
}

export class FileWatcher {
  private watcher: FSWatcher | null = null
  private options: WatcherOptions

  constructor(options: WatcherOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    if (this.watcher) return

    this.watcher = watch(this.options.paths, {
      persistent: true,
      ignoreInitial: true,
      ignored: this.options.ignoredPatterns,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    })

    this.watcher.on('add', (path) => {
      this.options.onEvent({ type: 'create', path, timestamp: Date.now() })
    })

    this.watcher.on('change', (path) => {
      this.options.onEvent({ type: 'modify', path, timestamp: Date.now() })
    })

    this.watcher.on('unlink', (path) => {
      this.options.onEvent({ type: 'delete', path, timestamp: Date.now() })
    })

    this.watcher.on('ready', () => {
      this.options.onReady()
    })

    this.watcher.on('error', (error: unknown) => {
      this.options.onError(error instanceof Error ? error : new Error(String(error)))
    })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }
}
