/**
 * Stats grow from Ark life (AnimalDex lane STATS-GROW, docs/ark/stats-grow.md, decisions 449-452): a captured animal's
 * card stats grow a little from what its own Ark animal does aboard (a hunt, an escape, defending its eggs, its first
 * young, raising one, a long life). THE RULE: the server decides and counts every point (`ark_stat_gains`, behind
 * `app_feature_flags.ark_stat_gains`); this file only reads what it sends and says it.
 *
 * - `decodeArkStatGains`: `voyage_animal_stat_gains_v1(p_animal_id)` (the /ark card's log, through `/api/ark/life`).
 * - `decodeCardStatGains`: the `ark_stat_gains` column of `discover_feed_v1` / `owned_capture_manifest_v1`, or the
 *   `ark_stat_gain_totals` RPC row (the card's stats: "+2 from the Ark").
 * Null while the switch is off, or when nothing was earned: the card is as it was.
 *
 * Lazy: only the card's chunk and the app's capture page import this (the /ark page's static JavaScript is budgeted).
 */

import type {ArkRecordNote} from "@/lib/ark-animal-status";

export const ARK_STAT_GAIN_STATS = ["dominance", "speed", "size", "intelligence"] as const;
export type ArkStatGainStat = (typeof ARK_STAT_GAIN_STATS)[number];
export const ARK_STAT_GAIN_SOURCES = ["hunt", "escape", "defend", "young", "raised", "old"] as const;
export type ArkStatGainSource = (typeof ARK_STAT_GAIN_SOURCES)[number];

/** The most a card can earn on the Ark, lifetime (the server's `ark_stat_gain_cap()`). */
export const ARK_STAT_GAIN_CAP = 5;

export type ArkStatGainLine = {stat: ArkStatGainStat; points: number; source: ArkStatGainSource; arkDay: number | null; at: string | null};
export type CardStatGains = Record<ArkStatGainStat, number> & {total: number};
export type ArkStatGains = CardStatGains & {lines: ArkStatGainLine[]};

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function points(value: unknown): number {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(ARK_STAT_GAIN_CAP, Math.round(n))) : 0;
}

/** The per-stat points of a card (feed / manifest column, or the RPC's row), or null when there are none. */
export function decodeCardStatGains(raw: unknown): CardStatGains | null {
    const row = record(Array.isArray(raw) ? raw[0] : raw);
    if (!row) return null;
    const out = {dominance: points(row.dominance), speed: points(row.speed), size: points(row.size), intelligence: points(row.intelligence), total: 0};
    out.total = Math.min(ARK_STAT_GAIN_CAP, out.dominance + out.speed + out.size + out.intelligence);
    return out.total > 0 ? out : null;
}

/** An Ark animal's earned points and their lines, newest first (`voyage_animal_stat_gains_v1`), or null. */
export function decodeArkStatGains(raw: unknown): ArkStatGains | null {
    const totals = decodeCardStatGains(raw);
    const row = record(raw);
    if (!totals || !row) return null;
    const lines: ArkStatGainLine[] = [];
    for (const item of Array.isArray(row.lines) ? row.lines.slice(0, ARK_STAT_GAIN_CAP) : []) {
        const line = record(item);
        const stat = line?.stat as ArkStatGainStat;
        const source = line?.source as ArkStatGainSource;
        if (!line || !ARK_STAT_GAIN_STATS.includes(stat) || !ARK_STAT_GAIN_SOURCES.includes(source)) continue;
        const day = typeof line.ark_day === "number" && Number.isFinite(line.ark_day) ? line.ark_day : null;
        lines.push({stat, source, points: Math.max(1, points(line.points)), arkDay: day, at: typeof line.at === "string" ? line.at.slice(0, 40) : null});
    }
    return {...totals, lines};
}

export type ArkGrewWords = {
    /** "Grew stronger: +{n} {stat} from {cause}" (a log line). */
    line: string;
    /** "+{n} from the Ark" (a card's stats). */
    total: string;
    /** What the server's points are, and the note under a card's stats. */
    note: string;
    stats: Record<ArkStatGainStat, string>;
    from: Record<ArkStatGainSource, string>;
};

export const ARK_GREW_ENGLISH: ArkGrewWords = {
    line: "Grew stronger: +{n} {stat} from {cause}",
    total: "+{n} from the Ark",
    note: "Earned by its animal on the Ark",
    stats: {dominance: "dominance", speed: "speed", size: "size", intelligence: "intelligence"},
    from: {hunt: "a hunt", escape: "an escape", defend: "defending its eggs", young: "its first young", raised: "raising its young", old: "a long life"}
};

/** The `ark.grew` words of a locale, English key by key where one is missing. */
export function arkGrewWords(given: unknown): ArkGrewWords {
    const row = record(given) ?? {};
    const pick = <T extends Record<string, string>>(english: T, value: unknown): T => {
        const from = record(value) ?? {};
        const out = {...english} as Record<string, string>;
        for (const key of Object.keys(english)) if (typeof from[key] === "string" && (from[key] as string).trim()) out[key] = from[key] as string;
        return out as T;
    };
    const top = pick({line: ARK_GREW_ENGLISH.line, total: ARK_GREW_ENGLISH.total, note: ARK_GREW_ENGLISH.note}, row);
    return {...top, stats: pick(ARK_GREW_ENGLISH.stats, row.stats), from: pick(ARK_GREW_ENGLISH.from, row.from)};
}

function fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? values[key] : all));
}

/** One log line, in the reader's words: "Grew stronger: +1 dominance from a hunt". */
export function arkGrewText(line: Pick<ArkStatGainLine, "stat" | "points" | "source">, words: ArkGrewWords, locale = "en"): string {
    return fill(words.line, {n: line.points.toLocaleString(locale), stat: words.stats[line.stat], cause: words.from[line.source]});
}

/** "+2 from the Ark". */
export function arkGrewTotal(total: number, words: ArkGrewWords, locale = "en"): string {
    return fill(words.total, {n: total.toLocaleString(locale)});
}

/**
 * The card's log lines (`noteRecord`): one per point, at the event's time, already said in the reader's words. Lines
 * with no time are left out (the log orders by time).
 */
export function arkStatGainNotes(animalId: string, gains: ArkStatGains | null, words: ArkGrewWords, locale = "en"): ArkRecordNote[] {
    if (!gains) return [];
    const notes: ArkRecordNote[] = [];
    gains.lines.forEach((line, index) => {
        const at = line.at ? Date.parse(line.at) : NaN;
        if (!Number.isFinite(at)) return;
        notes.push({animalId, id: `grew:${animalId}:${line.at}:${index}`, kind: "said", at, day: line.arkDay === null ? null : Math.floor(line.arkDay), text: arkGrewText(line, words, locale)});
    });
    return notes;
}
