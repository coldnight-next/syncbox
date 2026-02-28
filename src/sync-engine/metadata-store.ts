import Database from 'better-sqlite3'
import type { VectorClock } from '../shared/types/peer'

export interface FileMetadata {
  path: string
  relativePath: string
  size: number
  modifiedAt: number
  checksum: string
  syncedAt: number
}

export class MetadataStore {
  private db: Database.Database | null = null

  open(dbPath: string): void {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('cache_size = -8000')
    this.initSchema()
  }

  private initSchema(): void {
    if (!this.db) throw new Error('Database not opened')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        path TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        modified_at INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_jobs (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 3,
        file_size INTEGER NOT NULL DEFAULT 0,
        checksum TEXT,
        batch_id TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        enqueued_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON sync_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_priority ON sync_jobs(priority, enqueued_at)
        WHERE status = 'queued';
      CREATE INDEX IF NOT EXISTS idx_jobs_path ON sync_jobs(file_path);

      CREATE TABLE IF NOT EXISTS vector_clocks (
        relative_path TEXT PRIMARY KEY,
        clock_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL,
        local_checksum TEXT,
        remote_checksum TEXT,
        local_device_id TEXT,
        remote_device_id TEXT,
        local_clock_json TEXT,
        remote_clock_json TEXT,
        conflict_type TEXT NOT NULL DEFAULT 'content',
        resolution TEXT,
        detected_at INTEGER NOT NULL,
        resolved_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_conflicts_path ON conflicts(relative_path);
      CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON conflicts(resolution)
        WHERE resolution IS NULL;

      CREATE TABLE IF NOT EXISTS transfer_stats (
        timestamp INTEGER NOT NULL,
        upload_bytes INTEGER NOT NULL DEFAULT 0,
        download_bytes INTEGER NOT NULL DEFAULT 0,
        files_transferred INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_stats_ts ON transfer_stats(timestamp);
    `)

    // Auto-prune stats older than 31 days
    this.db.prepare('DELETE FROM transfer_stats WHERE timestamp < ?').run(Date.now() - 31 * 24 * 60 * 60 * 1000)
  }

  getFileMetadata(path: string): FileMetadata | undefined {
    if (!this.db) throw new Error('Database not opened')
    const row = this.db
      .prepare('SELECT * FROM file_metadata WHERE path = ?')
      .get(path) as Record<string, unknown> | undefined

    if (!row) return undefined

    return {
      path: row.path as string,
      relativePath: row.relative_path as string,
      size: row.size as number,
      modifiedAt: row.modified_at as number,
      checksum: row.checksum as string,
      syncedAt: row.synced_at as number,
    }
  }

  upsertFileMetadata(metadata: FileMetadata): void {
    if (!this.db) throw new Error('Database not opened')
    this.db
      .prepare(
        `INSERT OR REPLACE INTO file_metadata (path, relative_path, size, modified_at, checksum, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        metadata.path,
        metadata.relativePath,
        metadata.size,
        metadata.modifiedAt,
        metadata.checksum,
        metadata.syncedAt,
      )
  }

  deleteFileMetadata(path: string): void {
    if (!this.db) throw new Error('Database not opened')
    this.db.prepare('DELETE FROM file_metadata WHERE path = ?').run(path)
  }

  getVectorClock(relativePath: string): VectorClock | undefined {
    if (!this.db) throw new Error('Database not opened')
    const row = this.db
      .prepare('SELECT clock_json FROM vector_clocks WHERE relative_path = ?')
      .get(relativePath) as { clock_json: string } | undefined
    if (!row) return undefined
    return JSON.parse(row.clock_json) as VectorClock
  }

  setVectorClock(relativePath: string, clock: VectorClock): void {
    if (!this.db) throw new Error('Database not opened')
    this.db
      .prepare(
        `INSERT OR REPLACE INTO vector_clocks (relative_path, clock_json, updated_at)
         VALUES (?, ?, ?)`,
      )
      .run(relativePath, JSON.stringify(clock), Date.now())
  }

  upsertTransferStat(timestamp: number, uploadBytes: number, downloadBytes: number, filesTransferred: number): void {
    if (!this.db) throw new Error('Database not opened')
    this.db
      .prepare(
        `INSERT INTO transfer_stats (timestamp, upload_bytes, download_bytes, files_transferred)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(timestamp) DO UPDATE SET
           upload_bytes = upload_bytes + excluded.upload_bytes,
           download_bytes = download_bytes + excluded.download_bytes,
           files_transferred = files_transferred + excluded.files_transferred`,
      )
      .run(timestamp, uploadBytes, downloadBytes, filesTransferred)
  }

  getTransferStats(fromTs: number, toTs: number): Array<{ timestamp: number; upload_bytes: number; download_bytes: number; files_transferred: number }> {
    if (!this.db) throw new Error('Database not opened')
    return this.db
      .prepare('SELECT * FROM transfer_stats WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp')
      .all(fromTs, toTs) as Array<{ timestamp: number; upload_bytes: number; download_bytes: number; files_transferred: number }>
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
