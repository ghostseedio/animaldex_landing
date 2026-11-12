/**
 * How a species' numbers aboard changed over a window, from the Ark's event
 * log (`voyage_events_since_v1`): how many came aboard, were born, were eaten,
 * died of old age or starved. For the species pages' "In the Ark" (SEO lane
 * S3), which are static and rebuilt daily, so the window ends at the read.
 *
 * Counted as /ark's 24-hour change counts (lane U1, `ark-population-change`):
 * each animal once per kind of change however many rows name it (a meal and
 * its `eaten` row are one animal eaten), breeds in their kind's row (A1).
 * Counts and species only, never who.
 */

import {arkEventRows} from "@/lib/ark-life";

export type ArkSpeciesTrend = {
    arrived: number;
    born: number;
    eaten: number;
    diedOld: number;
    starved: number;
    /** Came aboard less left. */
    net: number;
};

export type ArkTrendWindow = {
    /** ISO time the window starts at. */
    since: string;
    /** ISO time of the read (the window's end). */
    until: string;
    /** False when the log could not be read to the end of the window: nothing is then said. */
    complete: boolean;
    events: unknown[];
};

const EMPTY: ArkSpeciesTrend = {arrived: 0, born: 0, eaten: 0, diedOld: 0, starved: 0, net: 0};

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

type Bucket = "arrived" | "born" | "eaten" | "diedOld" | "starved";

/** Which count a row adds to, and whose animal it names (a meal names its prey as `other`). */
function bucketOf(kind: string): {bucket: Bucket; field: "animal" | "other"} | null {
    switch (kind) {
        case "arrival":
            return {bucket: "arrived", field: "animal"};
        case "birth":
            return {bucket: "born", field: "animal"};
        case "eaten":
            return {bucket: "eaten", field: "animal"};
        case "meal":
            return {bucket: "eaten", field: "other"};
        case "death_old":
            return {bucket: "diedOld", field: "animal"};
        case "starved":
            return {bucket: "starved", field: "animal"};
        default:
            return null;
    }
}

/**
 * Every species' changes in the window, keyed by its kind's species_profile_id
 * (`kindOf` maps a look to its kind; a species no longer aboard keeps its own id).
 */
export function arkSpeciesTrends(raw: unknown, kindOf: (speciesProfileId: string) => string | null): Map<string, ArkSpeciesTrend> {
    const seen = new Set<string>();
    const out = new Map<string, ArkSpeciesTrend>();
    for (const item of arkEventRows(raw)) {
        const row = record(item);
        const kind = text(row?.kind);
        const how = kind ? bucketOf(kind) : null;
        if (!row || !how) continue;
        const animal = record(row[how.field]);
        const id = text(animal?.id);
        const look = text(animal?.species_profile_id) ?? (how.field === "animal" ? text(row.species_profile_id) : null);
        if (!id || !look) continue;
        const once = `${how.bucket}|${id}`;
        if (seen.has(once)) continue;
        seen.add(once);
        const key = kindOf(look) ?? look;
        const trend = out.get(key) ?? {...EMPTY};
        trend[how.bucket]++;
        trend.net = trend.arrived + trend.born - trend.eaten - trend.diedOld - trend.starved;
        out.set(key, trend);
    }
    return out;
}

/** One species' changes (all zero when nothing happened to it in the window). */
export function arkSpeciesTrendOf(trends: Map<string, ArkSpeciesTrend>, keys: string[]): ArkSpeciesTrend {
    const total = {...EMPTY};
    for (const key of Array.from(new Set(keys.map((value) => value.toLowerCase())))) {
        const trend = trends.get(key);
        if (!trend) continue;
        total.arrived += trend.arrived;
        total.born += trend.born;
        total.eaten += trend.eaten;
        total.diedOld += trend.diedOld;
        total.starved += trend.starved;
    }
    total.net = total.arrived + total.born - total.eaten - total.diedOld - total.starved;
    return total;
}

export type ArkTrendWords = {
    /** "In the 7 days to {date}: {changes}." */
    line: string;
    /** "Nothing came aboard or left in the 7 days to {date}." */
    none: string;
    arrived: string;
    born: string;
    eaten: string;
    diedOld: string;
    starved: string;
    /** Joins the changes ("2 came aboard, 1 was born"). */
    separator: string;
};

/** The trend in words: each non-zero change with its count, in a fixed order. */
export function arkSpeciesTrendLine(trend: ArkSpeciesTrend, words: ArkTrendWords, date: string, locale: string): string {
    const parts: string[] = [];
    const add = (count: number, template: string) => {
        if (count > 0) parts.push(template.replace("{count}", count.toLocaleString(locale)));
    };
    add(trend.arrived, words.arrived);
    add(trend.born, words.born);
    add(trend.eaten, words.eaten);
    add(trend.diedOld, words.diedOld);
    add(trend.starved, words.starved);
    if (!parts.length) return words.none.replace("{date}", date);
    return words.line.replace("{date}", date).replace("{changes}", parts.join(words.separator));
}
