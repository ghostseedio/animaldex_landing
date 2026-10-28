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

export function googlePlayLink(placement: StorePlacement) {
    const url = new URL(googlePlayUrl);
    url.searchParams.set("referrer", `utm_source=web&utm_campaign=${placement}`);
    return url.toString();
}

export function storeHref(store: AppStoreName, placement: StorePlacement) {
    return store === "app_store" ? appStoreLink(placement) : googlePlayLink(placement);
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
