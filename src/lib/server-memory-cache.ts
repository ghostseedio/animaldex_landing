type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

type GlobalCacheStore = typeof globalThis & {
    __adexServerMemoryCache?: Map<string, CacheEntry<unknown>>;
    __adexServerMemoryCachePending?: Map<string, Promise<unknown>>;
};

const store = globalThis as GlobalCacheStore;

function cacheMap() {
    if (!store.__adexServerMemoryCache) {
        store.__adexServerMemoryCache = new Map();
    }
    return store.__adexServerMemoryCache;
}

function pendingMap() {
    if (!store.__adexServerMemoryCachePending) {
        store.__adexServerMemoryCachePending = new Map();
    }
    return store.__adexServerMemoryCachePending;
}

export function readServerMemoryCache<T>(key: string): T | null {
    const entry = cacheMap().get(key) as CacheEntry<T> | undefined;
    if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) cacheMap().delete(key);
        return null;
    }
    return entry.value;
}

export async function withServerMemoryCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = readServerMemoryCache<T>(key);
    if (cached != null) return cached;

    const pending = pendingMap().get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const load = loader().then((value) => {
        cacheMap().set(key, {value, expiresAt: Date.now() + ttlMs});
        return value;
    }).finally(() => {
        pendingMap().delete(key);
    });
    pendingMap().set(key, load);
    return load;
}

export function devCacheTtlMs(productionTtlMs: number) {
    return process.env.NODE_ENV === "development" ? Math.min(productionTtlMs, 5 * 60 * 1000) : productionTtlMs;
}
