/**
 * The site's locales, without next-intl's request config, so plain modules and
 * their tests can read them (`@/i18n` re-exports this).
 */
export const localeConfig = {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    localePrefix: 'as-needed' as const,
    // URL prefix is the locale source of truth. Auto-detecting from
    // Accept-Language / NEXT_LOCALE would write Set-Cookie on every
    // anonymous crawl and keep public SEO HTML out of the CDN.
    localeDetection: false,
    // next-intl would otherwise advertise /id twins for every path,
    // including collapsed English-only detail families that 308.
    // Page metadata owns hreflang; Indonesian stays on real /id pages.
    alternateLinks: false
}
