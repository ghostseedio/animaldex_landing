// Higgsfield image-to-video, ported from the app's species-explainer-video
// edge function (~/AnimalDex/supabase/functions/species-explainer-video):
// presigned upload of the source photo, a price estimate, an idempotent
// submit, and polling the authenticated status URL (its webhooks are
// unsigned, so polling is the only result that cannot be spoofed).

const BASE = "https://api.higgsfield.ai";

export const MOTION_STYLE_SUFFIX =
    "Keep the subject, framing and lighting exactly as in the photo. Natural, believable motion; " +
    "smooth slow camera movement. No text, no captions, no logos, no added people or animals.";

export const HOOK_STYLE_SUFFIX =
    "This is the opening hook of a viral vertical video: grab attention in the very first second with a bold, " +
    "cinematic, dynamic camera move and lively natural motion, then hold the subject in a striking frame. " +
    "Keep the subject and its species exactly as in the photo. No text, no captions, no logos, no added people or animals.";

export const MOTION_NEGATIVE_PROMPT =
    "text, watermark, logo, distorted anatomy, extra limbs, extra heads, morphing, melting, flicker, cartoon";

export function higgsfieldAuthorization(): string | null {
    // The console issues an id and a secret; the header joins them. Either
    // variable may already hold the joined "id:secret".
    const combined = [process.env.HIGGSFIELD_API_KEY, process.env.HIGGSFIELD_API_KEY_ID].map((value) => value?.trim()).find((value) => value?.includes(":"));
    if (combined) return `Key ${combined}`;
    const id = process.env.HIGGSFIELD_API_KEY_ID?.trim();
    const secret = process.env.HIGGSFIELD_API_KEY_SECRET?.trim();
    return id && secret ? `Key ${id}:${secret}` : null;
}

export function textToImagePath() {
    return process.env.CONTENT_VIDEO_T2I_PATH?.trim() || process.env.HIGGSFIELD_T2I_PATH?.trim() || "/higgsfield-ai/soul/v2/standard";
}

/** A text-to-image request for a clip's first frame. */
export function keyframePayload(prompt: string) {
    return {prompt: prompt.slice(0, 2400), aspect_ratio: "9:16", resolution: "720p", batch_size: 1};
}

export type ImagePoll = {status: "pending" | "completed" | "failed"; imageUrl?: string; error?: string};

export async function pollImage(authorization: string, statusUrl: string): Promise<ImagePoll> {
    if (!statusUrl.startsWith(`${BASE}/`)) return {status: "failed", error: "unexpected status URL"};
    const response = await fetch(statusUrl, {headers: {Authorization: authorization}, cache: "no-store", signal: AbortSignal.timeout(30_000)});
    if (!response.ok) return {status: "pending"};
    const body = await response.json() as {status?: string; error?: unknown; images?: Array<{url?: string}>};
    if (body.status === "failed" || body.status === "nsfw" || body.status === "canceled") {
        return {status: "failed", error: String(body.error ?? body.status).slice(0, 200)};
    }
    const imageUrl = body.images?.[0]?.url;
    if (body.status === "completed" && imageUrl) return {status: "completed", imageUrl};
    return {status: "pending"};
}

export function imageToVideoPath(isHook: boolean) {
    const standard = process.env.CONTENT_VIDEO_I2V_PATH?.trim() || process.env.HIGGSFIELD_I2V_PATH?.trim() || "/kling-video/v2.5-turbo/standard/image-to-video";
    return isHook ? (process.env.CONTENT_VIDEO_HOOK_I2V_PATH?.trim() || standard) : standard;
}

/** Puts a JPEG where Higgsfield can read it; returns the URL to pass as image_url. */
export async function uploadImage(authorization: string, jpeg: Buffer): Promise<string> {
    const response = await fetch(`${BASE}/files/generate-upload-url`, {
        method: "POST",
        headers: {Authorization: authorization, "Content-Type": "application/json"},
        body: JSON.stringify({content_type: "image/jpeg"}),
        signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`higgsfield upload url ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const target = await response.json() as {public_url?: string; upload_url?: string; upload_headers?: Record<string, string>};
    if (!target.public_url || !target.upload_url) throw new Error("higgsfield upload url: missing fields");
    // Presigned storage URL: the Higgsfield credentials must NOT be sent here.
    const put = await fetch(target.upload_url, {
        method: "PUT",
        headers: {"Content-Type": "image/jpeg", ...(target.upload_headers ?? {})},
        body: new Uint8Array(jpeg),
        signal: AbortSignal.timeout(60_000)
    });
    if (!put.ok) throw new Error(`higgsfield upload ${put.status}`);
    return target.public_url;
}

/**
 * USD from the estimate endpoint (`{"credits": "1.500", "usd": "0.094"}`).
 * Only USD-named fields: credits read as dollars would wreck the budget.
 */
export function parseEstimateUSD(payload: unknown): number | null {
    const keys = ["usd", "cost_usd", "price_usd"];
    const visit = (value: unknown, depth: number): number | null => {
        if (depth > 4 || value === null || typeof value !== "object") return null;
        const record = value as Record<string, unknown>;
        for (const key of keys) {
            const candidate = record[key];
            const number = typeof candidate === "string" ? Number(candidate) : candidate;
            if (typeof number === "number" && Number.isFinite(number) && number >= 0) return number;
        }
        for (const nested of Object.values(record)) {
            const found = visit(nested, depth + 1);
            if (found !== null) return found;
        }
        return null;
    };
    return visit(payload, 0);
}

export async function estimateUSD(authorization: string, path: string, payload: Record<string, unknown>): Promise<number | null> {
    try {
        const response = await fetch(`${BASE}/estimate${path}`, {
            method: "POST",
            headers: {Authorization: authorization, "Content-Type": "application/json"},
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30_000)
        });
        return response.ok ? parseEstimateUSD(await response.json()) : null;
    } catch {
        return null;
    }
}

export async function submit(authorization: string, path: string, payload: Record<string, unknown>, idempotencyKey: string) {
    const response = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            // A retried submit must not be billed twice for the same clip.
            "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000)
    });
    const body = await response.json().catch(() => ({})) as {request_id?: string; status_url?: string; error?: unknown; detail?: unknown};
    if (!response.ok || !body.request_id) {
        throw new Error(`higgsfield submit ${response.status}: ${JSON.stringify(body.error ?? body.detail ?? "").slice(0, 200)}`);
    }
    return {requestId: body.request_id, statusUrl: body.status_url ?? `${BASE}/requests/${body.request_id}/status`};
}

export type ClipPoll = {status: "pending" | "completed" | "failed"; videoUrl?: string; error?: string};

export async function poll(authorization: string, statusUrl: string): Promise<ClipPoll> {
    // Only ever send the key to Higgsfield itself.
    if (!statusUrl.startsWith(`${BASE}/`)) return {status: "failed", error: "unexpected status URL"};
    const response = await fetch(statusUrl, {headers: {Authorization: authorization}, cache: "no-store", signal: AbortSignal.timeout(30_000)});
    if (!response.ok) return {status: "pending"};
    const body = await response.json() as {status?: string; error?: unknown; video?: {url?: string}};
    if (body.status === "failed" || body.status === "nsfw" || body.status === "canceled") {
        return {status: "failed", error: String(body.error ?? body.status).slice(0, 200)};
    }
    if (body.status === "completed" && body.video?.url) return {status: "completed", videoUrl: body.video.url};
    return {status: "pending"};
}
