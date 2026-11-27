/**
 * Where a visitor is, and what that means for prices.
 *
 * Production runs behind Cloudflare → nginx → the Next container. Cloudflare
 * adds `CF-IPCountry` (ISO 3166-1 alpha-2) to every request, and the VM's
 * nginx passes client headers through untouched (it only sets Host and the
 * X-Forwarded-* / X-Real-IP headers), so Next reads it as `cf-ipcountry`.
 * Cloudflare sends `XX` when it has no country and `T1` for Tor; both mean
 * "unknown" here, so callers fall back to the browser's language.
 *
 * Country beats language: an en-US browser in the UK shows GBP, an Indonesian
 * phone set to plain `id` (no region) in Jakarta shows IDR.
 */

/** The request header Cloudflare puts the visitor's country in. */
export const COUNTRY_HEADER = "cf-ipcountry";

/** A two-letter country code from `CF-IPCountry` (or any ISO alpha-2 value), or null for unknown / Tor / junk. */
export function normalizeCountry(value: string | null | undefined): string | null {
    const code = value?.trim().toUpperCase();
    if (!code || !/^[A-Z]{2}$/.test(code)) return null;
    if (code === "XX" || code === "T1") return null;
    return code === "UK" ? "GB" : code;
}

const EURO_COUNTRIES = [
    "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
    // Use the euro without being in the eurozone.
    "AD", "MC", "SM", "VA", "ME", "XK"
];

/** Country → display currency, only for currencies the site can show (`DISPLAY_CURRENCY_CODES`). */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
    ...Object.fromEntries(EURO_COUNTRIES.map((country) => [country, "EUR"])),
    US: "USD", PR: "USD", GU: "USD", VI: "USD", AS: "USD", MP: "USD", EC: "USD", SV: "USD", PA: "USD", TL: "USD",
    GB: "GBP", IM: "GBP", JE: "GBP", GG: "GBP",
    ID: "IDR", AU: "AUD", CA: "CAD", NZ: "NZD", IN: "INR", JP: "JPY", KR: "KRW", SG: "SGD", MY: "MYR", PH: "PHP",
    TH: "THB", ZA: "ZAR", BR: "BRL", MX: "MXN", CH: "CHF", LI: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", GL: "DKK",
    FO: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", IL: "ILS", IS: "ISK", HK: "HKD", CN: "CNY"
};

/** The display currency for a country, or null when the site has no currency for it. */
export function currencyForCountry(country: string | null | undefined): string | null {
    const code = normalizeCountry(country);
    return code ? CURRENCY_BY_COUNTRY[code] ?? null : null;
}

/** Accept-Language tags, best first (q-weighted, then the browser's order). */
export function rankedLanguageTags(header: string | null | undefined): string[] {
    if (!header) return [];
    return header
        .split(",")
        .map((entry, order) => {
            const [tag, ...params] = entry.trim().split(";");
            const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
            const q = qParam ? Number(qParam.slice(2)) : 1;
            return {tag: tag.trim(), q: Number.isFinite(q) ? q : 0, order};
        })
        .filter((entry) => entry.tag && entry.tag !== "*" && entry.q > 0)
        .sort((a, b) => b.q - a.q || a.order - b.order)
        .map((entry) => entry.tag);
}

/** The region of a language tag ("en-GB" → "GB", "zh-Hant-TW" → "TW"), or null. */
export function regionOfLanguageTag(tag: string | null | undefined): string | null {
    const parts = (tag ?? "").trim().replace(/_/g, "-").split("-").slice(1);
    const region = parts.find((part) => /^[A-Za-z]{2}$/.test(part));
    return region ? normalizeCountry(region) : null;
}

/**
 * The visitor's country: Cloudflare's when it knows it, else the region of
 * the browser's best language that names one, else null.
 */
export function resolveVisitorCountry(params: {country?: string | null; acceptLanguage?: string | null; languages?: readonly string[] | null}): string | null {
    const fromEdge = normalizeCountry(params.country);
    if (fromEdge) return fromEdge;
    const tags = params.languages?.length ? [...params.languages] : rankedLanguageTags(params.acceptLanguage);
    for (const tag of tags) {
        const region = regionOfLanguageTag(tag);
        if (region) return region;
    }
    return null;
}

/**
 * The "System" display currency: the edge country's currency when Cloudflare
 * knows the country (USD when the site has none for it, never a guess from
 * language), else the first browser language whose region has one, else null.
 */
export function systemCurrencyFor(params: {country?: string | null; acceptLanguage?: string | null; languages?: readonly string[] | null}): string | null {
    if (normalizeCountry(params.country)) return currencyForCountry(params.country) ?? "USD";
    const tags = params.languages?.length ? [...params.languages] : rankedLanguageTags(params.acceptLanguage);
    for (const tag of tags) {
        const currency = currencyForCountry(regionOfLanguageTag(tag));
        if (currency) return currency;
    }
    return null;
}
