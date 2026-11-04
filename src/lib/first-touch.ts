/**
 * First touch: the page and referring site a visitor first arrived on, kept in
 * a first-party cookie so a web signup days later can still say where it came
 * from. /api/app/device hands it to record_user_acquisition for new accounts,
 * and /admin/metrics groups signups by it.
 */

export const FIRST_TOUCH_COOKIE = "adx_ft";
export const FIRST_TOUCH_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"] as const;

export type FirstTouch = {
    landing_path: string;
    referrer_host?: string;
    at: string;
} & Partial<Record<(typeof UTM_KEYS)[number], string>>;

function clean(value: string | null | undefined, max: number) {
    const text = (value ?? "").replace(/[\u0000-\u001f]/g, "").trim();
    return text ? text.slice(0, max) : undefined;
}

/** The visit's first touch, or null when the referrer is our own site (a later page of the same visit). */
export function firstTouchFromLocation(href: string, referrer: string, now = new Date()): FirstTouch | null {
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    let referrerHost: string | undefined;
    if (referrer) {
        try {
            const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
            if (host === url.hostname.toLowerCase().replace(/^www\./, "")) return null;
            referrerHost = clean(host, 200);
        } catch {
            // An unparseable referrer is treated as none.
        }
    }
    const touch: FirstTouch = {landing_path: clean(url.pathname, 300) ?? "/", at: now.toISOString()};
    if (referrerHost) touch.referrer_host = referrerHost;
    for (const key of UTM_KEYS) {
        const value = clean(url.searchParams.get(key), 200);
        if (value) touch[key] = value;
    }
    return touch;
}

export function serializeFirstTouch(touch: FirstTouch) {
    return encodeURIComponent(JSON.stringify(touch));
}

export function parseFirstTouch(raw: string | null | undefined): FirstTouch | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
        const landing = typeof parsed.landing_path === "string" ? clean(parsed.landing_path, 300) : undefined;
        if (!landing || !landing.startsWith("/")) return null;
        const touch: FirstTouch = {landing_path: landing, at: typeof parsed.at === "string" ? parsed.at.slice(0, 40) : ""};
        if (typeof parsed.referrer_host === "string") touch.referrer_host = clean(parsed.referrer_host, 200);
        for (const key of UTM_KEYS) {
            if (typeof parsed[key] === "string") touch[key] = clean(parsed[key] as string, 200);
        }
        return touch;
    } catch {
        return null;
    }
}
