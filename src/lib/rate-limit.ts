type Bucket = {
    hits: number[];
};

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
};

/**
 * In-memory sliding window. Per serverless instance, so it throttles rather than
 * hard-caps a distributed attacker — enough to stop a single client hammering
 * paid generation, and cheap enough to run on every request.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const bucket = buckets.get(key) ?? {hits: []};
    const hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);

    if (hits.length >= limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
        buckets.set(key, {hits});
        return {allowed: false, remaining: 0, retryAfterSeconds};
    }

    hits.push(now);
    buckets.set(key, {hits});

    if (buckets.size > MAX_TRACKED_KEYS) {
        buckets.forEach((trackedBucket, trackedKey) => {
            if (trackedBucket.hits.every((timestamp: number) => now - timestamp >= windowMs)) {
                buckets.delete(trackedKey);
            }
        });
    }

    return {allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0};
}

export function getRequestIdentifier(request: Request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return request.headers.get("x-real-ip")?.trim() || "unknown";
}
