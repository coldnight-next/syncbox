import type { SyncJob, JobStatus } from '../shared/types/sync'

/**
 * Priority queue for sync jobs.
 * Uses a min-heap with composite sort key: (priority, enqueuedAt, fileSize).
 */
export class SyncQueue {
  private jobs: Map<string, SyncJob> = new Map()

  enqueue(job: SyncJob): void {
    this.jobs.set(job.id, job)
  }

  dequeue(): SyncJob | undefined {
    const queued = this.getQueuedJobs()
    if (queued.length === 0) return undefined

    // Sort by priority (ascending), then enqueuedAt (ascending), then fileSize (ascending)
    queued.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      if (a.enqueuedAt !== b.enqueuedAt) return a.enqueuedAt - b.enqueuedAt
      return a.fileSize - b.fileSize
    })

    const job = queued[0]
    job.status = 'active'
    return job
  }

  updateStatus(jobId: string, status: JobStatus): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = status
    }
  }

  getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId)
  }

  removeJob(jobId: string): void {
    this.jobs.delete(jobId)
  }

  getQueuedJobs(): SyncJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status === 'queued')
  }

  getPendingCount(): number {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === 'queued' || j.status === 'pending',
    ).length
  }

  getActiveCount(): number {
    return Array.from(this.jobs.values()).filter((j) => j.status === 'active').length
  }

  clear(): void {
    this.jobs.clear()
  }

  get size(): number {
    return this.jobs.size
  }
}
