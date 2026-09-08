/** Keep in sync with `localeConfig` in `src/i18n.ts`. */
const locales = ["en", "id"] as const;
const defaultLocale = "en";

/**
 * External `/en` and `/en/...` URLs must 308 to the unprefixed canonical.
 * Do **not** put that redirect in `next.config.js`: next-intl `as-needed`
 * rewrites unprefixed English to `/en/...` internally, and a config redirect
 * then fires on the rewritten path → self-308 loop on standalone/`next start`.
 */
export function matchDefaultLocalePrefixedPath(pathname: string): string | null {
    if (pathname === "/en" || pathname === "/en/") {
        return "/";
    }
    if (pathname.startsWith("/en/")) {
        const rest = pathname.slice("/en".length);
        return rest.length > 0 ? rest : "/";
    }
    return null;
}

export const protectedAppPrefixes = [
    "/app/arena",
    "/app/capture",
    "/app/collection",
    "/app/credits",
    "/app/billing",
    "/app/journal",
    "/app/import",
    "/app/matchups",
    "/app/messages",
    "/app/missions",
    "/app/notifications",
    "/app/profile",
    "/app/earnings",
    "/app/guides",
    "/app/sets",
    "/app/trades",
    "/app/train"
] as const;

export function splitLocalePath(pathname: string) {
    const segments = pathname.split("/");
    const firstSegment = segments[1];
    const hasLocalePrefix = (locales as readonly string[]).includes(firstSegment);
    const locale = hasLocalePrefix ? firstSegment : defaultLocale;
    const appPath = hasLocalePrefix ? `/${segments.slice(2).join("/")}` : pathname;

    return {
        locale,
        appPath: appPath === "/" ? "/" : appPath.replace(/\/+$/, "") || "/"
    };
}

export function isProtectedAppPath(pathname: string) {
    const {appPath} = splitLocalePath(pathname);

    return protectedAppPrefixes.some((prefix) => appPath === prefix || appPath.startsWith(`${prefix}/`));
}

/**
 * Session refresh is required when a Supabase auth cookie is already present,
 * or when the route is a server-enforced app gate. Anonymous public SEO
 * traffic should not contact Supabase Auth.
 */
export function middlewareShouldRefreshSession(pathname: string, hasAuthCookie: boolean) {
    return hasAuthCookie || isProtectedAppPath(pathname);
}
