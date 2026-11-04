import {splitLocalePath} from "@/lib/request-routing";

/** The bare store pages: the app's identity (structured data, sameAs). Links people click carry a placement. */
export const appStoreUrl = "https://apps.apple.com/app/6761607780";
export const googlePlayUrl = "https://play.google.com/store/apps/details?id=app.animaldex";

export const storeLinks = [
    {
        name: "App Store",
        store: "app_store",
        href: appStoreUrl
    },
    {
        name: "Google Play",
        store: "google_play",
        href: googlePlayUrl
    }
] as const;

export type AppStoreName = "app_store" | "google_play";

/**
 * Where on the website a store link sits. It is the App Store campaign
 * (`ct`) and the Play install referrer's `utm_campaign`, so installs can be
 * traced to the page that sent them. `page_<section>` is a generic store
 * button, named after the first path segment of the page it is on.
 */
export type StorePlacement =
    | "home_hero"
    | "home_more"
    | "home_download"
    | "species_hero"
    | "species_card"
    | "species_footer"
    | "share_sheet"
    | "chat_limit"
    | "profile_pack"
    | "wild_profile"
    | "import_result"
    | "post"
    | "not_found"
    | `page_${string}`;

/**
 * App Store Connect's provider token (App Analytics → Campaigns). Apple
 * attributes `ct` only together with `pt`, so until it is set the campaign
 * is in the link but not yet counted. Inlined at build time.
 */
export const APP_STORE_PROVIDER_TOKEN = process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN?.trim() ?? "";

export function appStoreLink(placement: StorePlacement, providerToken: string = APP_STORE_PROVIDER_TOKEN) {
    const url = new URL(appStoreUrl);
    if (providerToken) url.searchParams.set("pt", providerToken);
    url.searchParams.set("ct", placement);
    if (providerToken) url.searchParams.set("mt", "8");
    return url.toString();
}

/**
 * `referral` is the sharer's code from a shared link's `?ref=`. Play hands the
 * whole referrer to the app on first launch, where it is stored raw, so the
 * code travels with the install. The App Store has no such channel, so its
 * link stays the placement alone. `path` is the page the button was clicked
 * on (`utm_content`), so /admin/metrics can name the exact page an Android
 * install came from; it is added on click, never at render.
 */
export function googlePlayLink(placement: StorePlacement, referral: string | null = null, path: string | null = null) {
    const url = new URL(googlePlayUrl);
    const ref = referral ? `&ref=${referral}` : "";
    const content = path ? `&utm_content=${encodeURIComponent(path.slice(0, 120))}` : "";
    url.searchParams.set("referrer", `utm_source=web&utm_campaign=${placement}${content}${ref}`);
    return url.toString();
}

export function storeHref(store: AppStoreName, placement: StorePlacement, referral: string | null = null, path: string | null = null) {
    return store === "app_store" ? appStoreLink(placement) : googlePlayLink(placement, referral, path);
}

/** A referral code as the app's share links carry it: letters, digits, `-` and `_`. */
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;

/** The `ref` of a query string ("?ref=abc123"), when it is a plausible referral code. */
export function shareReferralCode(search: string | null | undefined): string | null {
    if (!search) return null;
    let value: string | null = null;
    try {
        value = new URLSearchParams(search).get("ref");
    } catch {
        return null;
    }
    const code = value?.trim() ?? "";
    return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/**
 * A shared post or profile opened with `?ref=` keeps the code for the rest of
 * the tab, so a store button clicked later (after the feed has rewritten the
 * URL, or on another page) still carries it.
 */
const SHARE_REFERRAL_KEY = "animaldex.share_ref";

export function rememberShareReferral(search: string | null | undefined) {
    const code = shareReferralCode(search);
    if (!code) return;
    try {
        window.sessionStorage.setItem(SHARE_REFERRAL_KEY, code);
    } catch {
        // Without storage the code still works while it is in the URL.
    }
}

/** The code in the current URL, else the one this tab arrived with. */
export function referringShareReferral(): string | null {
    try {
        const fromUrl = shareReferralCode(window.location.search);
        if (fromUrl) return fromUrl;
        const stored = window.sessionStorage.getItem(SHARE_REFERRAL_KEY);
        return stored && REFERRAL_CODE_PATTERN.test(stored) ? stored : null;
    } catch {
        return null;
    }
}

/** `page_<first path segment>`, for a store button that does not name its own placement. */
export function pageStorePlacement(pathname: string | null | undefined): StorePlacement {
    // Without the locale prefix: "/id/animals/fox" is still "animals".
    const first = splitLocalePath(pathname || "/").appPath.split("/").filter(Boolean)[0] ?? "home";
    const section = first.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "home";
    return `page_${section}`;
}

/**
 * A "Get the app" link that goes to the home page's download section first
 * (/#download) leaves its placement here, so the store button clicked there
 * credits the page that sent the reader. Per tab, for half an hour.
 */
const REFERRING_PLACEMENT_KEY = "animaldex.store_placement";
const REFERRING_PLACEMENT_MS = 30 * 60 * 1000;

export function rememberStorePlacement(placement: StorePlacement) {
    try {
        window.sessionStorage.setItem(REFERRING_PLACEMENT_KEY, JSON.stringify({placement, at: Date.now()}));
    } catch {
        // The download section's own placement is used instead.
    }
}

export function referringStorePlacement(now = Date.now()): StorePlacement | null {
    try {
        const raw = window.sessionStorage.getItem(REFERRING_PLACEMENT_KEY);
        const parsed = raw ? JSON.parse(raw) as {placement?: unknown; at?: unknown} : null;
        if (!parsed || typeof parsed.placement !== "string" || typeof parsed.at !== "number") return null;
        if (now - parsed.at > REFERRING_PLACEMENT_MS) return null;
        return /^[a-z0-9_-]{1,60}$/.test(parsed.placement) ? parsed.placement as StorePlacement : null;
    } catch {
        return null;
    }
}
