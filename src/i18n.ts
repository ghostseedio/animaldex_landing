import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
    const localeFile = await import(`./data/locales/${locale}.json`);
    const messages = localeFile.default || {};

    return {
        messages
    }
});

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
