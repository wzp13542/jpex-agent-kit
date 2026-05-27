import { RateLimitError } from "./errors.js";

export type RateLimitBucket = "public" | "private" | "write";

interface BucketState {
  tokens: number;
  updatedAt: number;
}

interface BucketConfig {
  capacity: number;
  refillPerSecond: number;
  maxWaitMs: number;
}

const DEFAULT_LIMITS: Record<RateLimitBucket, BucketConfig> = {
  public: { capacity: 10, refillPerSecond: 10, maxWaitMs: 5_000 },
  private: { capacity: 10, refillPerSecond: 10, maxWaitMs: 5_000 },
  write: { capacity: 3, refillPerSecond: 3, maxWaitMs: 10_000 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private readonly states = new Map<RateLimitBucket, BucketState>();

  constructor(private readonly limits: Record<RateLimitBucket, BucketConfig> = DEFAULT_LIMITS) {}

  async take(bucket: RateLimitBucket): Promise<void> {
    const limit = this.limits[bucket];
    const start = Date.now();

    while (true) {
      const now = Date.now();
      const state = this.states.get(bucket) ?? { tokens: limit.capacity, updatedAt: now };
      const elapsed = Math.max(0, (now - state.updatedAt) / 1000);
      state.tokens = Math.min(limit.capacity, state.tokens + elapsed * limit.refillPerSecond);
      state.updatedAt = now;

      if (state.tokens >= 1) {
        state.tokens -= 1;
        this.states.set(bucket, state);
        return;
      }

      const waitMs = Math.ceil(((1 - state.tokens) / limit.refillPerSecond) * 1000);
      this.states.set(bucket, state);
      if (now - start + waitMs > limit.maxWaitMs) {
        throw new RateLimitError(bucket);
      }
      await sleep(waitMs);
    }
  }
}
