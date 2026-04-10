export function getSiteUrl() {
    const configuredUrl = process.env.CANONICAL_URL
        || (process.env.NODE_ENV === "development"
            ? `http://localhost:${process.env.PORT || 3000}`
            : process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "https://animaldex.app");

    return configuredUrl.replace(/\/$/, "");
}

export function getLocalePath(locale: string, path = "") {
    const normalisedPath = path === "/" ? "" : path;
    return `/${locale}${normalisedPath}`;
}

export function getAbsoluteUrl(locale: string, path = "") {
    return new URL(getLocalePath(locale, path), getSiteUrl()).toString();
}

export function getMetadataLocale(locale: string) {
    const localeMap: Record<string, string> = {
        en: "en_US",
        id: "id_ID"
    };

    return localeMap[locale] || locale;
}
