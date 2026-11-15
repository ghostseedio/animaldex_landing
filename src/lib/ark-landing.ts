/**
 * The home page's live Ark as `/api/ark/landing` answers it (`src/data/ark-landing.ts` builds it on the server), and
 * the one read the page's sections share: the numbers, the day's awake counts and the populations chart all wait on
 * the same request, made once per page load.
 */

import type {ArkLandingHunt} from "@/lib/ark-hunting";
import type {ArkPopulationSeries} from "@/lib/ark-population-series";

export type {ArkLandingHunt};

export type ArkLandingSummary = {
    available: boolean;
    /** When the snapshot was read (the server's `as_of`). */
    asOf: string | null;
    /** When the voyage's clock started. */
    startedAt: string | null;
    counts: {animals: number; species: number; founders: number};
    /** The last 24 hours of the log; null when it could not be read whole. */
    today: {since: string; arrivals: number; births: number; meals: number; deaths: number} | null;
    /** The species with the most aboard, biggest first (the Ark is what people photograph). */
    top: Array<{name: string; slug: string; count: number}>;
    /** How many of those aboard are awake at each island hour (0–23), by the scene's own rule (`isAwake`). */
    awake: number[];
    series: ArkPopulationSeries | null;
    /** When predators next hunt (`voyage_hunting_v1`), so a 0 in the meals figure is never shown bare; null: unread. */
    hunt?: ArkLandingHunt | null;
};

export type ArkMealsWaitWords = {
    /** "First hunts from {date}". */
    firstOn: string;
    /** "First hunt in {duration}". */
    firstIn: string;
    /** "Next hunts from {date}". */
    nextOn: string;
    /** "Next hunt in {duration}". */
    nextIn: string;
};

const HOUR_MS = 3_600_000;

/**
 * The line the meals figure shows in place of a 0 while no predator is due: the date of the soonest hunt (the
 * viewer's locale and time zone) when it is a day or more away, else how long until it. Null when there is nothing
 * honest to say (no read, a real 0, or the time has already come).
 */
export function arkMealsWait(hunt: ArkLandingHunt | null | undefined, nowMs: number, locale: string, words: ArkMealsWaitWords, timeZone?: string): string | null {
    if (!hunt || hunt.state !== "waiting") return null;
    const at = Date.parse(hunt.at);
    if (!Number.isFinite(at) || at <= nowMs) return null;
    const wait = at - nowMs;
    if (wait >= 24 * HOUR_MS) {
        const date = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", ...(timeZone ? {timeZone} : {})}).format(at);
        // (Kept on one line: "Nov 20" never breaks between the month and the day.)
        return (hunt.first ? words.firstOn : words.nextOn).replace("{date}", date.replace(/ /g, "\u00a0"));
    }
    const hours = wait >= HOUR_MS;
    const amount = hours ? Math.round(wait / HOUR_MS) : Math.max(1, Math.ceil(wait / 60_000));
    const duration = new Intl.NumberFormat(locale, {style: "unit", unit: hours ? "hour" : "minute", unitDisplay: "short"}).format(amount);
    return (hunt.first ? words.firstIn : words.nextIn).replace("{duration}", duration.replace(/ /g, "\u00a0"));
}

let read: Promise<ArkLandingSummary | null> | null = null;

/** The live Ark for this page load (null when it cannot be read). */
export function fetchArkLanding(): Promise<ArkLandingSummary | null> {
    read ??= fetch("/api/ark/landing")
        .then((response) => (response.ok ? (response.json() as Promise<ArkLandingSummary>) : null))
        .then((summary) => (summary && summary.available ? summary : null))
        .catch(() => null);
    return read;
}
