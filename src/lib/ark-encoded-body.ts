import {promisify} from "node:util";
import {brotliCompress, constants, gzip} from "node:zlib";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

/** One response body, encoded once: its JSON bytes, gzip and brotli of them, and its validator. */
export type ArkEncodedBody = {json: Buffer; gzip: Buffer; br: Buffer; etag: string};

/**
 * The anonymous `/api/ark/voyage` answer is ~4.7 MB of JSON, the same for everyone while the shared read holds it
 * (`data/ark-voyage.ts`). Decoding, encoding and compressing it per request is what made 10 concurrent visitors
 * take 9–30 s on the web VM (2026-11-20), so it is done once per source answer: `get(keys, build)` answers the body
 * built for the same key objects (by identity), and concurrent callers for new keys share one build.
 */
export function createArkEncodedBodyCache() {
    let held: {keys: readonly unknown[]; body: ArkEncodedBody} | null = null;
    let pending: {keys: readonly unknown[]; body: Promise<ArkEncodedBody>} | null = null;
    const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((k, i) => k === b[i]);

    return {
        async get(keys: readonly unknown[], build: () => Promise<{payload: unknown; etag: string}>): Promise<ArkEncodedBody> {
            if (held && same(held.keys, keys)) return held.body;
            if (pending && same(pending.keys, keys)) return pending.body;
            const entry = {
                keys,
                body: (async () => {
                    const {payload, etag} = await build();
                    const json = Buffer.from(JSON.stringify(payload));
                    // Brotli at quality 5: about gzip's time, a smaller body (11 takes seconds on 4.7 MB).
                    const [g, b] = await Promise.all([gz(json, {level: 6}), brotli(json, {params: {[constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_SIZE_HINT]: json.length}})]);
                    return {json, gzip: g, br: b, etag};
                })()
            };
            pending = entry;
            try {
                const body = await entry.body;
                if (pending === entry) held = {keys, body};
                return body;
            } finally {
                if (pending === entry) pending = null;
            }
        },
        reset() {
            held = null;
            pending = null;
        }
    };
}

/** The encoding to send for a request's `Accept-Encoding`: brotli, else gzip, else none. */
export function arkPickEncoding(acceptEncoding: string | null): "br" | "gzip" | null {
    const accepted = new Map<string, number>();
    for (const part of (acceptEncoding ?? "").toLowerCase().split(",")) {
        const [name, ...params] = part.trim().split(";");
        if (!name) continue;
        const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
        accepted.set(name, q ? Number(q.slice(2)) || 0 : 1);
    }
    const ok = (name: string) => (accepted.get(name) ?? (accepted.has("*") ? accepted.get("*")! : 0)) > 0;
    if (ok("br")) return "br";
    if (ok("gzip")) return "gzip";
    return null;
}
