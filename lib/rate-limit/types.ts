export type RateLimitConfig = {
  /** Unique bucket name, e.g. `guest-write` */
  name: string;
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec?: number;
};

export interface RateLimitStore {
  check(config: RateLimitConfig, key: string): RateLimitResult;
}
