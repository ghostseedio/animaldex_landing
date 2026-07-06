const LOCALE_MAP: Record<string, string> = {
    en: "en-US",
    id: "id-ID"
};

export function getAppDateLocale(locale?: string | null) {
    if (!locale) return "en-US";
    return LOCALE_MAP[locale] ?? "en-US";
}

function parseDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAppShortDate(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {day: "numeric", month: "short"}).format(date);
}

export function formatAppShortDateWithYear(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {day: "numeric", month: "short", year: "numeric"}).format(date);
}

export function formatAppTime(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {hour: "numeric", minute: "2-digit"}).format(date);
}

export function formatAppShortDateTime(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

export function formatAppInboxWhen(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay ? formatAppTime(value, locale) : formatAppShortDate(value, locale);
}

export function formatAppLongDate(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {month: "long", day: "numeric", year: "numeric"}).format(date);
}

export function formatAppDateTime(value: string, locale?: string | null) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat(getAppDateLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}
