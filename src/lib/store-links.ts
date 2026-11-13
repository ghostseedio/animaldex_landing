import {splitLocalePath} from "@/lib/request-routing";
import {storePlatformFromUserAgent} from "@/lib/store-platform";

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
 * Where on the website a store link sits: the link's *surface*. It is the App
 * Store campaign (`ct`) and the Play install referrer's `utm_medium`, so
 * installs can be traced to the button that sent them. `page_<section>` is a
 * generic store button, named after the first path segment of the page it is on.
 */
export type StorePlacement =
    | "home_hero"
    | "home_more"
    | "home_download"
    | "home_ark"
    | "home_qr"
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
    /** The install buttons on the big tier lists (CC 2, Nov 2026); `utm_content` names the list. */
    | "tierlist"
    /** The Ask limit panel's "Keep talking in the app, free" (CC 2, Nov 2026). */
    | "ask_limit"
    | `page_${string}`;

/**
 * Extras a store link can carry besides its placement (CC 2, Nov 2026).
 * Additive: every existing caller passes none and gets the same link.
 *
 * - `content`: a fixed `utm_content` ("tierlist_strongest-animals",
 *   "ask_limit") instead of the page path the click would otherwise add.
 * - `handoff`: a web Ask hand-off id (lib/ask-handoff), in the Play install
 *   referrer so the Android app can pick the conversation up after install.
 */
export type StoreLinkOptions = {
    content?: string | null;
    handoff?: string | null;
};

const UTM_CONTENT_MAX = 120;
const HANDOFF_ID = /^[0-9a-f-]{8,40}$/i;

function cleanContent(content: string | null | undefined) {
    const value = (content ?? "").trim().replace(/[^A-Za-z0-9_./-]/g, "").slice(0, UTM_CONTENT_MAX);
    return value || null;
}

function cleanHandoff(handoff: string | null | undefined) {
    const value = (handoff ?? "").trim();
    return HANDOFF_ID.test(value) ? value : null;
}

/**
 * App Store Connect's provider token (App Analytics → Campaigns). Apple
 * attributes `ct` only together with `pt`, so without it the campaign
 * parameters are left off the link altogether (the GA click event still
 * names the button). Inlined at build time: the browser and the server have
 * to build the same href, so the public variable is the one the site reads;
 * `APP_STORE_PROVIDER_TOKEN` alone reaches links built on the server only
 * (`serverAppStoreProviderToken`: the QR redirect, the bio links).
 */
export const APP_STORE_PROVIDER_TOKEN = process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN?.trim() ?? "";

/** The provider token for a link built on the server: the public variable, else `APP_STORE_PROVIDER_TOKEN`. */
export function serverAppStoreProviderToken(): string {
    return APP_STORE_PROVIDER_TOKEN || (process.env.APP_STORE_PROVIDER_TOKEN?.trim() ?? "");
}

/**
 * `utm_source` of every store link on the website. The admin's web-install
 * gate accepts it beside the older `web` (`isWebsiteStoreSource`).
 */
export const WEB_STORE_SOURCE = "animaldex_web";

export function isWebsiteStoreSource(source: string | null | undefined): boolean {
    return source === WEB_STORE_SOURCE || source === "web";
}

/** A campaign token Apple and Play accept: lower-case letters, digits, `_` and `-`, at most 40 characters. */
function campaignToken(value: string | null | undefined, max = 40): string {
    return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, max);
}

/**
 * The App Store campaign (`ct`), one per surface: the surface itself for a
 * website link, `<source>_<surface>` for a link that names another source (a
 * social bio: `tiktok_bio`), so Apple's campaign report tells them apart.
 */
export function appStoreCampaignToken(source: string, surface: string): string {
    const normalizedSource = campaignToken(source);
    return campaignToken(normalizedSource === WEB_STORE_SOURCE || !normalizedSource ? surface : `${normalizedSource}_${surface}`);
}

export type StoreUrlInput = {
    store: AppStoreName;
    /** The link's surface: a placement on the website (`home_hero`, `share_sheet`, `page_animals`) or `bio`. */
    surface: string;
    /**
     * The page the link is on, without the locale prefix ("/", "/animals/lion",
     * "/tier-list/apex-predators"), or a page name ("profile") off the website.
     * Play's `utm_campaign`; left off when empty.
     */
    page?: string | null;
    /** The button: `badge`, `text_link`, `qr`, `tierlist_<slug>`, `ask_limit`... Play's `utm_content`. */
    button: string;
    /** `utm_source`: the website by default; a social bio names its platform (`tiktok`). */
    source?: string;
    /** A shared link's referral code (`?ref=`): rides in the Play install referrer, never on the App Store link. */
    referral?: string | null;
    /** App Store Connect's provider token; the environment's by default. */
    providerToken?: string;
    /** A web Ask hand-off id (lib/ask-handoff): in the Play install referrer only, so the Android app can resume the conversation (CC 2). */
    handoff?: string | null;
};

/**
 * Every store URL the site hands out, built one way:
 *
 * - App Store: `?pt=<APP_STORE_PROVIDER_TOKEN>&ct=<campaign>&mt=8`, where the
 *   campaign is the surface (`appStoreCampaignToken`); the bare store page
 *   when the token is not set, since Apple ignores `ct` without `pt`.
 * - Google Play: `&referrer=utm_source=animaldex_web&utm_medium=<surface>
 *   &utm_campaign=<page>&utm_content=<button>[&ref=<code>]`. Play hands the
 *   referrer to the app on first launch, where it is stored raw, so the
 *   campaign names the exact page and the content the exact button
 *   (/admin/metrics reads both, `landingOf`).
 */
export function buildStoreUrl(input: StoreUrlInput): string {
    const source = campaignToken(input.source) || WEB_STORE_SOURCE;
    const surface = campaignToken(input.surface) || "web";
    const page = (input.page ?? "").trim().slice(0, 120);
    const button = campaignToken(input.button, 60) || "link";
    if (input.store === "app_store") {
        const providerToken = (input.providerToken ?? APP_STORE_PROVIDER_TOKEN).trim();
        if (!providerToken) return appStoreUrl;
        const url = new URL(appStoreUrl);
        url.searchParams.set("pt", providerToken);
        url.searchParams.set("ct", appStoreCampaignToken(source, surface));
        url.searchParams.set("mt", "8");
        return url.toString();
    }
    const parts = [`utm_source=${encodeURIComponent(source)}`, `utm_medium=${encodeURIComponent(surface)}`];
    if (page) parts.push(`utm_campaign=${encodeURIComponent(page)}`);
    parts.push(`utm_content=${encodeURIComponent(button)}`);
    if (input.referral && REFERRAL_CODE_PATTERN.test(input.referral)) parts.push(`ref=${input.referral}`);
    const handoff = cleanHandoff(input.handoff);
    if (handoff) parts.push(`handoff=${handoff}`);
    const url = new URL(googlePlayUrl);
    url.searchParams.set("referrer", parts.join("&"));
    return url.toString();
}

/** The App Store link for a surface (older callers: the page and button are not known here). */
export function appStoreLink(placement: StorePlacement, providerToken: string = APP_STORE_PROVIDER_TOKEN, options: StoreLinkOptions = {}) {
    return buildStoreUrl({store: "app_store", surface: placement, button: cleanContent(options.content) ?? "link", providerToken});
}

/**
 * The Play link for a surface. `referral` is the sharer's code from a shared
 * link's `?ref=`; `path` is the page the button is on (`utm_campaign`), so
 * /admin/metrics can name the exact page an Android install came from.
 */
export function googlePlayLink(placement: StorePlacement, referral: string | null = null, path: string | null = null, options: StoreLinkOptions = {}) {
    // A fixed content ("tierlist_<slug>", "ask_limit") names the button (CC 2); a hand-off id rides the referrer.
    return buildStoreUrl({store: "google_play", surface: placement, page: path, button: cleanContent(options.content) ?? "link", referral, handoff: options.handoff});
}

export function storeHref(store: AppStoreName, placement: StorePlacement, referral: string | null = null, path: string | null = null, options: StoreLinkOptions = {}) {
    return store === "app_store" ? appStoreLink(placement, APP_STORE_PROVIDER_TOKEN, options) : googlePlayLink(placement, referral, path, options);
}

/**
 * Which store a browser's user agent belongs to: iPhone, iPad and iPod (and
 * iPadOS Safari, which says "Macintosh" with touch) go to the App Store,
 * Android to Google Play, and anything else (a desktop) to neither, so a
 * page shows both buttons. Decided in the browser after hydration: the pages
 * that use it are static.
 */
export function detectStorePlatform(userAgent: string | null | undefined, maxTouchPoints = 0): AppStoreName | null {
    return storePlatformFromUserAgent(userAgent, maxTouchPoints);
}

/** The buttons in the order a page shows them: the reader's own store first, the other after it. */
export function orderedStores(platform: AppStoreName | null): AppStoreName[] {
    return platform === "google_play" ? ["google_play", "app_store"] : ["app_store", "google_play"];
}

/** The social profiles whose bio carries a store link. */
export const SOCIAL_BIO_PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const;
export type SocialBioPlatform = (typeof SOCIAL_BIO_PLATFORMS)[number];

/**
 * The store link in a social profile's bio: `utm_source=<platform>`,
 * `utm_medium=bio`, the profile as the page and `link_in_bio` as the button
 * (App Store: `ct=<platform>_bio`).
 */
export function socialBioStoreUrl(platform: SocialBioPlatform, store: AppStoreName, providerToken: string = serverAppStoreProviderToken()): string {
    return buildStoreUrl({store, source: platform, surface: "bio", page: "profile", button: "link_in_bio", providerToken});
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

/** The page a store link is on, as Play's `utm_campaign` says it: the path without the locale prefix. */
export function storeLinkPage(pathname: string | null | undefined): string {
    return splitLocalePath(pathname || "/").appPath;
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
