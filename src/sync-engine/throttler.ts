/**
 * Token bucket rate limiter for bandwidth throttling.
 * Pure Node.js — no Electron dependencies.
 */
export class TokenBucketThrottler {
  private tokens: number
  private maxTokens: number
  private rate: number // bytes per second (0 = unlimited)
  private lastRefill: number

  constructor(bytesPerSec: number = 0) {
    this.rate = bytesPerSec
    this.maxTokens = bytesPerSec > 0 ? bytesPerSec * 2 : 0
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
  }

  /** Update the rate limit at runtime. 0 = unlimited. */
  setRate(bytesPerSec: number): void {
    this.rate = bytesPerSec
    this.maxTokens = bytesPerSec > 0 ? bytesPerSec * 2 : 0
    this.tokens = Math.min(this.tokens, this.maxTokens)
    this.lastRefill = Date.now()
  }

  /** Consume bytes, delaying if necessary to enforce the rate limit. */
  async consume(bytes: number): Promise<void> {
    if (this.rate <= 0) return // unlimited

    this.refill()

    if (this.tokens >= bytes) {
      this.tokens -= bytes
      return
    }

    // Wait for enough tokens to accumulate
    const deficit = bytes - this.tokens
    const waitMs = (deficit / this.rate) * 1000
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
    this.refill()
    this.tokens = Math.max(0, this.tokens - bytes)
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.rate)
    this.lastRefill = now
  }
}
