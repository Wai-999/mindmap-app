interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Not distributed-safe (per-process only, resets on
// restart) — sufficient for a single-instance deployment. Swap for Upstash Redis
// (or similar) if this ever runs across multiple instances.
const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
