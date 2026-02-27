export interface FileInfo {
  path: string
  size: number
  modifiedAt: number
  checksum?: string
  isDirectory: boolean
}

export interface UploadOptions {
  localPath: string
  remotePath: string
  checksum?: string
  signal?: AbortSignal
  onProgress?: (bytesTransferred: number, totalBytes: number) => void
}

export interface DownloadOptions {
  remotePath: string
  localPath: string
  signal?: AbortSignal
  onProgress?: (bytesTransferred: number, totalBytes: number) => void
}

export interface StorageProvider {
  readonly name: string

  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  listFiles(remotePath: string): Promise<FileInfo[]>
  getFileInfo(remotePath: string): Promise<FileInfo | null>

  upload(options: UploadOptions): Promise<void>
  download(options: DownloadOptions): Promise<void>
  delete(remotePath: string): Promise<void>
  move(fromPath: string, toPath: string): Promise<void>

  createDirectory(remotePath: string): Promise<void>
  deleteDirectory(remotePath: string): Promise<void>
}
