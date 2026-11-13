import {createHash} from "node:crypto";

/**
 * The validator of an anonymous `/api/ark/voyage` answer (payload lane, docs/ark/perf-audit-mobile-2026-11.md): the
 * apps' Ark panel reads the Ark every 45 s and got the whole answer (~400 KB brotli'd for the real Ark) each time, though
 * it rarely changes between reads. With this ETag an unchanged Ark answers 304 and the browser keeps the body it has.
 *
 * "Unchanged" is what the scene lays out (`src/ark-scene/runtime/same.ts` sameArkRead): every field the same but the
 * read's own time (`as_of`) and its Ark day, which moves with it; the day counts in steps of 0.05 (about 2.7 minutes, far
 * under anything it shows: a nest's stage, a young animal's growth), so a reader keeping an earlier body keeps an earlier
 * (as_of, ark_day) pair, consistent between themselves, never more than a step behind.
 */
export function arkVoyageEtag(payload: {snapshot?: unknown} & Record<string, unknown>): string {
    const snapshot = (payload.snapshot ?? null) as ({ark_day?: unknown} & Record<string, unknown>) | null;
    const day = snapshot && typeof snapshot.ark_day === "number" && Number.isFinite(snapshot.ark_day) ? Math.floor(snapshot.ark_day * 20) : null;
    const normalised = snapshot ? {...payload, snapshot: {...snapshot, as_of: null, ark_day: day}} : payload;
    return `W/"ark-${createHash("sha1").update(JSON.stringify(normalised)).digest("base64url")}"`;
}

/** Whether a request's `If-None-Match` names this ETag (a list, `*`, weak or strong). */
export function arkEtagMatches(ifNoneMatch: string | null, etag: string): boolean {
    if (!ifNoneMatch) return false;
    const bare = etag.replace(/^W\//, "");
    return ifNoneMatch.split(",").some((tag) => {
        const t = tag.trim();
        return t === "*" || t.replace(/^W\//, "") === bare;
    });
}
