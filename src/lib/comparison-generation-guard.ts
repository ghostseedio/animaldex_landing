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
 * plus the per-IP and site-wide rate limits in the route.
 */

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
