import {ARK_DAYS_PER_REAL_DAY} from "@/lib/ark-time-left-constants";

/**
 * Ark time said in the visitor's own time (owner 2026-11-20, lane ARK-SIMPLE: "ark years means nothing for new users,
 * need to translate everything in human time units"). One Ark day is about 55 real minutes (365 Ark days to 14 real
 * days, `ARK_DAYS_PER_REAL_DAY`), so an animal's age, its time left and a log line are said as the real minutes, hours,
 * days, weeks or months a visitor lives through. Every word comes from the browser's own `Intl` (unit and relative-time
 * formats), so all 45 of the Ark's languages say it with no strings of ours.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30.44 * DAY_MS;
const YEAR_MS = 365.25 * DAY_MS;

/** Real milliseconds in a count of Ark days. */
export function arkDaysToMs(arkDays: number): number {
    return (arkDays / ARK_DAYS_PER_REAL_DAY) * DAY_MS;
}

export type ArkHumanUnit = "minute" | "hour" | "day" | "week" | "month" | "year";

/** The unit a span reads best in: minutes under an hour, hours under two days, days under three weeks, weeks under three months, months under two years. */
export function arkHumanUnit(ms: number): {unit: ArkHumanUnit; size: number} {
    const abs = Math.abs(ms);
    if (abs < HOUR_MS) return {unit: "minute", size: MINUTE_MS};
    if (abs < 2 * DAY_MS) return {unit: "hour", size: HOUR_MS};
    if (abs < 21 * DAY_MS) return {unit: "day", size: DAY_MS};
    if (abs < 3 * MONTH_MS) return {unit: "week", size: WEEK_MS};
    if (abs < 2 * YEAR_MS) return {unit: "month", size: MONTH_MS};
    return {unit: "year", size: YEAR_MS};
}

const unitFormats = new Map<string, Intl.NumberFormat | null>();
function unitFormat(locale: string, unit: ArkHumanUnit, display: "long" | "short"): Intl.NumberFormat | null {
    const key = `${locale}|${unit}|${display}`;
    if (!unitFormats.has(key)) {
        try {
            unitFormats.set(key, new Intl.NumberFormat(locale, {style: "unit", unit, unitDisplay: display, maximumFractionDigits: 0}));
        } catch {
            unitFormats.set(key, null);
        }
    }
    return unitFormats.get(key) ?? null;
}

const ENGLISH_UNIT: Record<ArkHumanUnit, string> = {minute: "min", hour: "h", day: "d", week: "wk", month: "mo", year: "y"};

/**
 * A real span ("2 days", "5 hours"), or a range of two in one unit ("2–5 days"): the unit is the larger end's, both ends
 * rounded to whole units (never 0: at least 1). `display` "short" for tight spots ("2 hr").
 */
export function arkHumanSpan(lowMs: number, highMs: number = lowMs, locale = "en", display: "long" | "short" = "long", plus = false): string {
    const {unit, size} = arkHumanUnit(Math.max(lowMs, highMs));
    const a = Math.max(1, Math.round(lowMs / size));
    const b = Math.max(a, Math.round(highMs / size));
    const format = unitFormat(locale, unit, display);
    const range = format as (Intl.NumberFormat & {formatRange?: (x: number, y: number) => string}) | null;
    let text: string;
    if (!format) text = a === b ? `${a} ${ENGLISH_UNIT[unit]}` : `${a}–${b} ${ENGLISH_UNIT[unit]}`;
    else if (a === b) text = format.format(a);
    else if (typeof range?.formatRange === "function") text = range.formatRange(a, b);
    else text = `${format.format(a)}–${format.format(b)}`;
    return plus ? `${text}+` : text;
}

/** A span of Ark days in real time: `arkHumanSpan` of their real length. */
export function arkHumanDays(lowArkDays: number, highArkDays: number = lowArkDays, locale = "en", display: "long" | "short" = "long", plus = false): string {
    return arkHumanSpan(arkDaysToMs(lowArkDays), arkDaysToMs(highArkDays), locale, display, plus);
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat | null>();

/** "2 hours ago", "5 min ago", "now": a past moment from `now`, in the reader's words (`short`: "2 hr. ago"). */
export function arkHumanAgo(at: number, now: number, locale = "en", style: "long" | "short" | "narrow" = "short"): string {
    const ms = Math.max(0, now - at);
    const key = `${locale}|${style}`;
    if (!relativeFormats.has(key)) {
        try {
            relativeFormats.set(key, new Intl.RelativeTimeFormat(locale, {numeric: "auto", style}));
        } catch {
            relativeFormats.set(key, null);
        }
    }
    const format = relativeFormats.get(key) ?? null;
    if (ms < MINUTE_MS) return format ? format.format(0, "second") : "now";
    const {unit, size} = arkHumanUnit(ms);
    const n = Math.max(1, Math.round(ms / size));
    return format ? format.format(-n, unit) : `${n} ${ENGLISH_UNIT[unit]} ago`;
}

/** The chance's horizon (one Ark year) in real time: "2 weeks". */
export function arkHumanYear(locale = "en"): string {
    return arkHumanDays(365, 365, locale);
}
