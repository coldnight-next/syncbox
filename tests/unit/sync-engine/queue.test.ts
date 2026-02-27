import { describe, it, expect, beforeEach } from 'vitest'
import { SyncQueue } from '../../../src/sync-engine/queue'
import type { SyncJob } from '../../../src/shared/types/sync'

function createJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: Math.random().toString(36).slice(2),
    filePath: '/test/file.txt',
    relativePath: 'file.txt',
    operationType: 'modify',
    priority: 3,
    enqueuedAt: Date.now(),
    fileSize: 1024,
    retryCount: 0,
    status: 'queued',
    checksum: null,
    batchId: null,
    ...overrides,
  }
}

describe('SyncQueue', () => {
  let queue: SyncQueue

  beforeEach(() => {
    queue = new SyncQueue()
  })

  it('enqueues and dequeues a job', () => {
    const job = createJob()
    queue.enqueue(job)

    expect(queue.size).toBe(1)

    const dequeued = queue.dequeue()
    expect(dequeued?.id).toBe(job.id)
    expect(dequeued?.status).toBe('active')
  })

  it('returns undefined when dequeueing empty queue', () => {
    expect(queue.dequeue()).toBeUndefined()
  })

  it('dequeues highest priority job first', () => {
    const low = createJob({ priority: 5, enqueuedAt: 1 })
    const high = createJob({ priority: 1, enqueuedAt: 2 })
    const normal = createJob({ priority: 3, enqueuedAt: 3 })

    queue.enqueue(low)
    queue.enqueue(high)
    queue.enqueue(normal)

    const first = queue.dequeue()
    expect(first?.id).toBe(high.id)
  })

  it('dequeues by enqueue time for same priority', () => {
    const older = createJob({ priority: 3, enqueuedAt: 100 })
    const newer = createJob({ priority: 3, enqueuedAt: 200 })

    queue.enqueue(newer)
    queue.enqueue(older)

    const first = queue.dequeue()
    expect(first?.id).toBe(older.id)
  })

  it('tracks pending and active counts', () => {
    queue.enqueue(createJob())
    queue.enqueue(createJob())

    expect(queue.getPendingCount()).toBe(2)
    expect(queue.getActiveCount()).toBe(0)

    queue.dequeue()

    expect(queue.getPendingCount()).toBe(1)
    expect(queue.getActiveCount()).toBe(1)
  })

  it('updates job status', () => {
    const job = createJob()
    queue.enqueue(job)
    queue.updateStatus(job.id, 'completed')

    const updated = queue.getJob(job.id)
    expect(updated?.status).toBe('completed')
  })

  it('clears all jobs', () => {
    queue.enqueue(createJob())
    queue.enqueue(createJob())
    queue.clear()

    expect(queue.size).toBe(0)
  })
})
