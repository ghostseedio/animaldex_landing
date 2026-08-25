/** Keep in sync with `localeConfig` in `src/i18n.ts`. */
const locales = ["en", "id"] as const;
const defaultLocale = "en";

export const protectedAppPrefixes = [
    "/app/arena",
    "/app/capture",
    "/app/collection",
    "/app/journal",
    "/app/matchups",
    "/app/messages",
    "/app/missions",
    "/app/notifications",
    "/app/profile",
    "/app/earnings",
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
