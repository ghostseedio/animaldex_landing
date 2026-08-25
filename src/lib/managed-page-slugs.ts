/**
 * Public CMS vanity URLs are kebab-case slugs. Internet scanners send paths
 * like `/wp-admin` that must never trigger a database lookup.
 */
const PLAUSIBLE_MANAGED_PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SCANNER_SINGLE_SEGMENT_SLUGS = new Set([
    "wp-admin",
    "wp-login",
    "wp-content",
    "wp-includes",
    "wp-json",
    "xmlrpc",
    "phpmyadmin",
    "phpinfo",
    "wordpress",
    "administrator",
    "cgi-bin",
    "vendor",
    "autoload",
    "eval-stdin",
    "actuator",
    "server-status",
    "xmlrpc-php",
    "wp-config"
]);

export function isPlausibleManagedPageSlug(slug: string) {
    if (!slug || slug.length < 2 || slug.length > 80) return false;
    if (slug.includes(".") || slug.includes("_") || slug.includes("%")) return false;
    return PLAUSIBLE_MANAGED_PAGE_SLUG.test(slug);
}

export function shouldLookupPublishedManagedPage(slug: string) {
    if (!isPlausibleManagedPageSlug(slug)) return false;
    return !SCANNER_SINGLE_SEGMENT_SLUGS.has(slug);
}
