/**
 * Which navigation entry the visitor is currently inside.
 *
 * The header previously had no active state at all, so the only feedback a nav
 * item gave was the global lime cursor blob passing over it. These helpers back
 * the typographic active marker instead, and they run on the client where the
 * only thing available is `usePathname()`.
 *
 * The locale prefixes are spelled out here rather than imported from `@/i18n`,
 * which pulls in `next-intl/server` and throws outside a Next request. The
 * matching test asserts this list never drifts from the routing config.
 */

const NAV_LOCALE_PREFIXES = ["en", "id"];

export function stripNavLocale(pathname: string): string {
    for (const locale of NAV_LOCALE_PREFIXES) {
        if (pathname === `/${locale}`) {
            return "/";
        }

        if (pathname.startsWith(`/${locale}/`)) {
            return pathname.slice(locale.length + 1);
        }
    }

    return pathname;
}

function normalise(path: string): string {
    const withoutQuery = path.split("?")[0]?.split("#")[0] ?? path;
    const trimmed = withoutQuery.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
}

/**
 * Hash targets (`/#download`, `/#features`) are in-page anchors on the home
 * page. Marking them active on every home-page visit would light up two nav
 * entries at once, so they never take the marker.
 */
export function isNavHrefActive(pathname: string | null | undefined, href: string): boolean {
    if (!pathname || href.includes("#")) {
        return false;
    }

    const current = normalise(stripNavLocale(pathname));
    const target = normalise(stripNavLocale(href));

    if (target === "/") {
        return current === "/";
    }

    return current === target || current.startsWith(`${target}/`);
}

export function isNavSectionActive(pathname: string | null | undefined, hrefs: string[]): boolean {
    return hrefs.some((href) => isNavHrefActive(pathname, href));
}
