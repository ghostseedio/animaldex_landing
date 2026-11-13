import type {AppStoreName} from "@/lib/store-links";

/**
 * Which store a visitor's device installs from, read from the user agent
 * after hydration (the home page is static, so the server cannot know).
 * iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen counts as
 * iOS. Anything else (a desktop, an unknown agent) is null: both stores show.
 */
export function storePlatformFromUserAgent(userAgent: string | null | undefined, maxTouchPoints = 0): AppStoreName | null {
    const agent = userAgent ?? "";
    if (/iPhone|iPad|iPod/i.test(agent)) return "app_store";
    if (/Macintosh/i.test(agent) && (/Mobile/i.test(agent) || maxTouchPoints > 1)) return "app_store";
    if (/Android/i.test(agent)) return "google_play";
    return null;
}

/** The other store, for the text link under the detected one. */
export function otherStore(store: AppStoreName): AppStoreName {
    return store === "app_store" ? "google_play" : "app_store";
}
