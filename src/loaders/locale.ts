import 'server-only';

export async function loadLocaleMessages(locale: string) {
    const localeFile = await import(`../data/locales/${locale}.json`);
    return localeFile.default as Record<string, any>;
}
