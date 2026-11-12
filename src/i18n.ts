/**
 * next-intl's request config (its `getRequestConfig` is the identity function,
 * so this is the same thing written without importing `next-intl/server`): that
 * import throws outside Next's bundler, and plain modules that read
 * `localeConfig` (lib/site, the SEO builders) and their tests import this file.
 */
export default async function getRequestConfig({locale}: {locale: string}) {
    const localeFile = await import(`./data/locales/${locale}.json`);
    const messages = localeFile.default || {};

    return {
        messages
    }
}

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
