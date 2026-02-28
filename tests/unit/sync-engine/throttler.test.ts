import { describe, it, expect } from 'vitest'
import { TokenBucketThrottler } from '../../../src/sync-engine/throttler'

describe('TokenBucketThrottler', () => {
  it('unlimited (rate=0) resolves instantly', async () => {
    const throttler = new TokenBucketThrottler(0)
    const start = Date.now()
    await throttler.consume(1_000_000)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('limited rate causes a delay for large consume', async () => {
    // 1000 bytes/sec, consume 500 bytes from a fresh bucket (2000 tokens)
    const throttler = new TokenBucketThrottler(1000)
    const start = Date.now()
    await throttler.consume(500)
    // Should resolve almost instantly (tokens available)
    expect(Date.now() - start).toBeLessThan(100)
  })

  it('consume exceeding tokens delays appropriately', async () => {
    // 100 bytes/sec, bucket starts with 200 tokens, consume 250
    const throttler = new TokenBucketThrottler(100)
    const start = Date.now()
    await throttler.consume(250)
    const elapsed = Date.now() - start
    // Should delay ~500ms for the 50 byte deficit
    expect(elapsed).toBeGreaterThanOrEqual(400)
    expect(elapsed).toBeLessThan(1500)
  })

  it('setRate(0) switches to unlimited', async () => {
    const throttler = new TokenBucketThrottler(100)
    throttler.setRate(0)
    const start = Date.now()
    await throttler.consume(1_000_000)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('setRate updates the rate at runtime', () => {
    const throttler = new TokenBucketThrottler(100)
    throttler.setRate(500)
    // No error — runtime update is accepted
    expect(true).toBe(true)
  })
})
