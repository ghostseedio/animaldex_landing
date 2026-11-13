import {createHmac, timingSafeEqual} from "crypto";
import {getSupabaseServiceKey} from "@/lib/supabase-http";

/**
 * Gates for paid on-demand comparison generation from the website.
 *
 * Oct 2026: a JS-rendering crawler walked every animal page's "Compare with"
 * links and the generating screen auto-started on load, minting ~560 paid
 * comparisons in three days. Generation now needs all of:
 *   1. a human click (the screen no longer auto-starts),
 *   2. a signed intent token issued when the page rendered, old enough that the
 *      click wasn't scripted the instant the page loaded and young enough that
 *      it wasn't harvested and replayed later,
 *   3. a same-origin browser request without a known bot user agent,
 *   4. (Nov 2026) a signed-in AnimalDex account or an admin session: an
 *      anonymous visitor or crawler reads published comparisons (the static
 *      pages and the snapshot) and never spends on a new one,
 *   5. (16 Nov 2026) COMPARISONS_GENERATE=on. The web side makes no new pairs
 *      at all by default (about $100 a month went on comparison copy and
 *      artwork); existing pages stay. The generator is the apps' edge function
 *      get-or-generate-species-comparison, so the apps are unaffected
 *      (docs/ops/comparisons-off.md has the matching server flag to add there),
 * plus the per-account, per-IP and site-wide rate limits in the route.
 * Repainting an existing comparison's artwork is for admins only.
 */

/** True only when COMPARISONS_GENERATE=on: the web may ask the edge function for a pair it does not have. Off by default. */
export function comparisonsGenerateEnabled(env: Record<string, string | undefined> = process.env) {
    return env.COMPARISONS_GENERATE?.trim().toLowerCase() === "on";
}

export const INTENT_MIN_AGE_MS = 1500;
export const INTENT_MAX_AGE_MS = 30 * 60 * 1000;

const BOT_USER_AGENT = /bot|crawl|spider|slurp|scrape|headless|phantom|puppeteer|playwright|selenium|lighthouse|python|curl|wget|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|facebookexternalhit|embedly|preview|gpt|claude|anthropic|perplexity|bytespider|ccbot|diffbot|semrush|ahrefs|mj12|dotbot|petal|yandex|baidu|bing|duckduck|applebot|amazonbot/i;

function intentSecret() {
    const key = process.env.COMPARISON_INTENT_SECRET || getSupabaseServiceKey();
    return key ? `comparison-intent:${key}` : null;
}

function sign(payload: string, secret: string) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Issued on the server when the generating screen renders; null when no secret is configured. */
export function issueComparisonIntent(slug: string, now = Date.now()): string | null {
    const secret = intentSecret();
    if (!secret) return null;
    const payload = `${slug}.${now}`;
    return `${now}.${sign(payload, secret)}`;
}

export type IntentCheck = "ok" | "missing" | "invalid" | "too_fast" | "expired";

export function verifyComparisonIntent(slug: string, token: unknown, now = Date.now()): IntentCheck {
    const secret = intentSecret();
    if (!secret) return "invalid";
    if (typeof token !== "string" || !token) return "missing";
    const [issuedRaw, signature] = token.split(".");
    const issuedAt = Number(issuedRaw);
    if (!Number.isFinite(issuedAt) || !signature) return "invalid";

    const expected = Buffer.from(sign(`${slug}.${issuedAt}`, secret));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";

    const age = now - issuedAt;
    if (age < INTENT_MIN_AGE_MS) return "too_fast";
    if (age > INTENT_MAX_AGE_MS) return "expired";
    return "ok";
}

export function looksLikeBot(userAgent: string | null) {
    if (!userAgent || userAgent.length < 20) return true;
    return BOT_USER_AGENT.test(userAgent);
}

/** Browsers send Sec-Fetch-Site on fetch(); a cross-site or missing value is not our page. */
export function isSameOriginBrowserRequest(request: Request) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite) return fetchSite === "same-origin";
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!origin || !host) return false;
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

/** Who is asking to spend: an admin session, a signed-in AnimalDex account, or nobody. */
export type GenerationRequester = {kind: "admin"} | {kind: "user"; userId: string} | {kind: "anonymous"};

export type GenerationRefusal = {status: 401 | 403; error: "sign_in_required" | "forbidden" | "intent_expired" | "generation_off"};

/** Null when this request may generate; otherwise the answer the route gives. */
export function generationRefusal(input: {
    requester: GenerationRequester;
    userAgent: string | null;
    sameOrigin: boolean;
    intent: IntentCheck;
    pairMatchesIntent: boolean;
    refreshImage: boolean;
    /** comparisonsGenerateEnabled(); defaults to the env so existing callers stay correct. */
    generationOn?: boolean;
}): GenerationRefusal | null {
    if (!(input.generationOn ?? comparisonsGenerateEnabled())) return {status: 403, error: "generation_off"};
    if (looksLikeBot(input.userAgent) || !input.sameOrigin) return {status: 403, error: "forbidden"};
    if (input.requester.kind === "anonymous") return {status: 401, error: "sign_in_required"};
    if (input.refreshImage && input.requester.kind !== "admin") return {status: 403, error: "forbidden"};
    if (input.intent === "expired") return {status: 403, error: "intent_expired"};
    if (input.intent !== "ok" || !input.pairMatchesIntent) return {status: 403, error: "forbidden"};
    return null;
}

/** New comparisons one signed-in account may start a day (COMPARISON_USER_DAILY_LIMIT, default 5). */
export function userDailyGenerationLimit(env: NodeJS.ProcessEnv = process.env) {
    const value = Number(env.COMPARISON_USER_DAILY_LIMIT);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}
