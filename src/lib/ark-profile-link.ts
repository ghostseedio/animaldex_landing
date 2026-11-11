/**
 * A bringer's @username, tapped inside the apps (iOS ark-founders-ios
 * 0e76d4fc, Android ark-founders-android d5b19f7): it must reach the app,
 * which opens the in-app profile. A client-side route change inside a
 * WebView is invisible to the app, so a bringer's link is a real link to
 * `/u/{handle}` (the apps intercept that navigation), and where the app's
 * bridge is there (the same one the embed talks through:
 * `webkit.messageHandlers.ark`, `window.AndroidArk`) it is told directly,
 * `{type: "ark:open-profile", handle}`, and the page stays where it is.
 */

export type ArkOpenProfileMessage = {type: "ark:open-profile"; handle: string};

type BridgeWindow = {
    webkit?: {messageHandlers?: {ark?: {postMessage: (message: unknown) => void}}};
    AndroidArk?: {postMessage: (text: string) => void};
};

export function arkOpenProfileMessage(handle: string): ArkOpenProfileMessage {
    return {type: "ark:open-profile", handle: handle.replace(/^@+/, "")};
}

/**
 * Tells the app to open this person's profile when the page runs in its
 * WebView: true when a bridge took it (the caller then keeps the page where
 * it is), false on the open web (the real link navigates).
 */
export function postArkOpenProfile(win: BridgeWindow | null | undefined, handle: string): boolean {
    const message = arkOpenProfileMessage(handle);
    try {
        const ios = win?.webkit?.messageHandlers?.ark;
        if (ios && typeof ios.postMessage === "function") {
            ios.postMessage(message);
            return true;
        }
        const android = win?.AndroidArk;
        if (android && typeof android.postMessage === "function") {
            android.postMessage(JSON.stringify(message));
            return true;
        }
    } catch {
        // A bridge that throws: the real link still goes.
    }
    return false;
}

/** The real link: `/u/{handle}`, with the site's locale prefix for a non-English page (`/id/u/{handle}`). */
export function arkProfileHref(handle: string, locale?: string | null): string {
    const path = `/u/${encodeURIComponent(handle.replace(/^@+/, ""))}`;
    return locale && locale !== "en" ? `/${locale}${path}` : path;
}
