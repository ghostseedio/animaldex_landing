import {rowStateFromZernio, ZernioError, type ZernioPostSnapshot} from "@/lib/social/zernio-core";
import {isZernioPlatform, type SocialPostOptions, type SocialPostRow, type ZernioPlatform, type ZernioShareInfo} from "@/lib/social/types";

// Keeps Zernio share-log rows (TikTok, Pinterest, Threads, Bluesky) in step with their Zernio post. One
// implementation for the share-log GET (pull: GET /v1/posts/{id} for rows that
// are still waiting) and the webhook (push: Zernio tells us). The pure helpers
// are importable from node:test; the network and DB calls are loaded lazily so
// this module never pulls the server-only client at import time.

/** A row synced within this window is not asked about again. */
export const SYNC_INTERVAL_MS = 20_000;
/** At most this many Zernio lookups per share-log request. */
export const MAX_SYNC_PER_REQUEST = 8;
/** TikTok hands Zernio the public URL minutes after publishing; keep asking a published row this long. */
export const URL_BACKFILL_WINDOW_MS = 60 * 60_000;
/** A rate-limited Zernio create is retried once when the wait is this short. */
export const MAX_RATE_LIMIT_WAIT_SECONDS = 90;

/** Seconds to wait before one retry of a rate-limited Zernio create, or null when it should not be retried. Pure. */
export function rateLimitRetryDelaySeconds(error: unknown, maxSeconds = MAX_RATE_LIMIT_WAIT_SECONDS): number | null {
    if (!(error instanceof ZernioError) || error.kind !== "rate_limited") return null;
    const seconds = error.retryAfterSeconds;
    if (seconds === null || seconds <= 0 || seconds > maxSeconds) return null;
    return seconds;
}

/**
 * TikTok rows that are waiting in Zernio and have not been checked recently,
 * plus published direct posts still missing their URL (TikTok resolves it some
 * minutes after publishing; inbox drafts never get one). Pure, for tests.
 */
export function rowsNeedingSync(rows: SocialPostRow[], now = Date.now()): SocialPostRow[] {
    return rows.filter((row) => {
        if (!isZernioPlatform(row.platform)) return false;
        const info = row.options?.zernio;
        if (!info?.postId) return false;
        const waiting = row.status === "queued" || row.status === "processing";
        if (!waiting) {
            if (row.status !== "published" || row.external_url || row.mode === "draft") return false;
            const since = Date.parse(info.publishedAt ?? row.updated_at);
            if (Number.isFinite(since) && now - since > URL_BACKFILL_WINDOW_MS) return false;
        }
        const synced = info.syncedAt ? Date.parse(info.syncedAt) : NaN;
        return !Number.isFinite(synced) || now - synced >= SYNC_INTERVAL_MS;
    });
}

/** The row's Zernio bookkeeping after seeing `snapshot`. Pure. */
export function zernioInfoAfter(existing: ZernioShareInfo | undefined, snapshot: ZernioPostSnapshot, now = new Date()): ZernioShareInfo {
    return {
        postId: snapshot.postId,
        scheduledFor: snapshot.scheduledFor ?? existing?.scheduledFor ?? null,
        timezone: existing?.timezone ?? null,
        platformPostId: snapshot.tiktok?.platformPostId ?? existing?.platformPostId ?? null,
        publishedAt: snapshot.publishedAt ?? existing?.publishedAt ?? null,
        syncedAt: now.toISOString()
    };
}

export type ZernioRowPatch = ReturnType<typeof rowStateFromZernio> & {external_id: string; options: SocialPostOptions};

/** Everything the share-log row gets from a Zernio post state. Pure, for tests. */
export function zernioPatchForRow(row: Pick<SocialPostRow, "options"> & {platform?: SocialPostRow["platform"]}, snapshot: ZernioPostSnapshot, now = new Date()): ZernioRowPatch {
    return {
        ...rowStateFromZernio(snapshot, isZernioPlatform(row.platform) ? row.platform : "tiktok"),
        external_id: snapshot.postId,
        options: {...(row.options ?? {}), zernio: zernioInfoAfter(row.options?.zernio, snapshot, now)}
    };
}

/** Applies a patch to an in-memory row the way the DB would. Pure. */
export function applyPatch(row: SocialPostRow, patch: ZernioRowPatch, now = new Date()): SocialPostRow {
    return {...row, ...patch, updated_at: now.toISOString()};
}

type SyncDeps = {
    getZernioPost: (postId: string, platform?: ZernioPlatform) => Promise<ZernioPostSnapshot>;
    updatePost: (id: string, patch: ZernioRowPatch | TerminalPatch) => Promise<void>;
};

type TerminalPatch = {status: "failed"; error: string; options: SocialPostOptions};

/** The row's end state when Zernio no longer has the post (deleted in the dashboard). Pure. */
export function goneFromZernioPatch(row: Pick<SocialPostRow, "options">, now = new Date()): TerminalPatch {
    const info = row.options?.zernio;
    return {
        status: "failed",
        error: "The post no longer exists in Zernio (deleted there before publishing)",
        options: {...(row.options ?? {}), zernio: {postId: info?.postId ?? "", scheduledFor: info?.scheduledFor ?? null, timezone: info?.timezone ?? null, platformPostId: info?.platformPostId ?? null, publishedAt: info?.publishedAt ?? null, syncedAt: now.toISOString()}}
    };
}

/** One reconcile at a time per process: overlapping share-log polls share it instead of repeating the lookups. */
let inFlight: Promise<SocialPostRow[]> | null = null;

async function loadDeps(): Promise<SyncDeps> {
    const [{getZernioPost}, {updatePost}] = await Promise.all([import("@/lib/social/zernio"), import("@/lib/social/store")]);
    return {getZernioPost, updatePost};
}

/**
 * Asks Zernio about the rows that are still waiting (at most MAX_SYNC_PER_REQUEST,
 * one at a time to stay inside Zernio's rate limit) and writes what changed.
 * Returns all `rows`, with the synced ones updated. A Zernio outage or rate
 * limit leaves the row as it was; other errors are logged and skipped too.
 */
export async function reconcileZernioRows(rows: SocialPostRow[], deps?: SyncDeps, now = new Date()): Promise<SocialPostRow[]> {
    const pending = rowsNeedingSync(rows, now.getTime()).slice(0, MAX_SYNC_PER_REQUEST);
    if (pending.length === 0) return rows;
    // A poll that arrives while a reconcile runs gets the rows it already has; the
    // next poll sees what the running one wrote.
    if (inFlight && !deps) return rows;
    const run = (async () => {
        const {getZernioPost, updatePost} = deps ?? await loadDeps();
        const updated = new Map<string, SocialPostRow>();
        for (const row of pending) {
            try {
                const snapshot = await getZernioPost(row.options!.zernio!.postId, isZernioPlatform(row.platform) ? row.platform : "tiktok");
                const patch = zernioPatchForRow(row, snapshot, now);
                await updatePost(row.id, patch);
                updated.set(row.id, applyPatch(row, patch, now));
            } catch (error) {
                if (error instanceof ZernioError && (error.kind === "unavailable" || error.kind === "rate_limited")) break;
                if (error instanceof ZernioError && error.kind === "not_found") {
                    // Deleted in Zernio: nothing will ever publish it, so stop waiting.
                    const patch = goneFromZernioPatch(row, now);
                    await updatePost(row.id, patch).catch(() => undefined);
                    updated.set(row.id, {...row, ...patch, updated_at: now.toISOString()});
                    continue;
                }
                console.warn(`[social-share] Zernio sync for ${row.id} failed:`, error instanceof Error ? error.message : error);
            }
        }
        return updated.size ? rows.map((row) => updated.get(row.id) ?? row) : rows;
    })();
    if (!deps) inFlight = run;
    try {
        return await run;
    } finally {
        if (inFlight === run) inFlight = null;
    }
}
