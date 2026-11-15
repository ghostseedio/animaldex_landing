/**
 * Lost from the Ark (owner, 2026-11-15: "can we show recently extinct species too somewhere"): the species whose last
 * animal is gone, as the server logged them (`voyage_extinctions_v1`, AnimalDex migration 20261124100000; read through
 * `/api/ark/extinct`). Contract: docs/ark/EXTINCT-CONTRACT.md.
 *
 * Truthful only: a species is listed only because the server logged its extinction, "Back aboard" only while the read
 * says a living one is aboard now, and how the last one went only as the event recorded it. Until the read exists the
 * route answers `available: false` and every surface hides the section.
 *
 * Plain functions, no DOM: /ark's overlay, the embed's bars (the apps), and the species page share them.
 */

export type ArkExtinctCause = "died_old" | "eaten" | "starved";

export type ArkExtinction = {
    speciesProfileId: string;
    name: string;
    scientificName: string | null;
    /** The Ark icon's slug (`animals/<slug>.webp`); null: the generic figure. */
    modelSlug: string | null;
    /** The species page's slug (`/animals/<slug>`); null: no page. */
    pageSlug: string | null;
    arkDay: number;
    /** When the server logged it (ISO). */
    at: string;
    /** How the last one went; null when the event did not say. */
    cause: ArkExtinctCause | null;
    /** The eater of the last one, for `eaten`. */
    eatenBy: {speciesProfileId: string; name: string; modelSlug: string | null} | null;
    /** Living animals of the species now. */
    aboard: number;
    /** A capture brought it back: one is alive now. */
    backAboard: boolean;
};

/** The section's words (`ark.lost` in the locale files). */
export type ArkLostWords = {
    /** "Lost from the Ark" */
    title: string;
    /** What the list is, under its title. */
    intro: string;
    /** "Extinct on Ark day {day} · {date}" */
    when: string;
    /** "Back aboard" */
    back: string;
    /** "Last one died of old age" */
    diedOld: string;
    /** "Last one eaten by {animal}" */
    eatenBy: string;
    /** "Last one eaten" (the eater not known) */
    eaten: string;
    /** "Last one starved" */
    starved: string;
    /** The species page: "Extinct on the Ark since Ark day {day} · {date}." */
    speciesLine: string;
    /** The species page, once back: "Back aboard: it died out on Ark day {day} · {date}." */
    speciesBack: string;
    /** The species page's count line while it is lost: "No {animal} is aboard now." */
    notAboard: string;
    /** "Catch one to bring it back" */
    bringBack: string;
    /** The list, for a screen reader. */
    listLabel: string;
};

export const ARK_LOST_WORDS_EN: ArkLostWords = {
    title: "Lost from the Ark",
    intro: "Species whose last animal is gone. Catching one brings it back.",
    when: "Extinct on Ark day {day} · {date}",
    back: "Back aboard",
    diedOld: "Last one died of old age",
    eatenBy: "Last one eaten by {animal}",
    eaten: "Last one eaten",
    starved: "Last one starved",
    speciesLine: "Extinct on the Ark since Ark day {day} · {date}.",
    speciesBack: "Back aboard: it died out on Ark day {day} · {date}.",
    notAboard: "No {animal} is aboard now.",
    bringBack: "Catch one to bring it back",
    listLabel: "Species lost from the Ark, newest first"
};

/** The words as a locale has them, English key by key where one is missing. */
export function arkLostWords(raw: unknown): ArkLostWords {
    const given = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const out = {...ARK_LOST_WORDS_EN};
    for (const key of Object.keys(out) as (keyof ArkLostWords)[]) {
        const value = given[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value: unknown, max = 200): string | null {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function slug(value: unknown): string | null {
    const said = text(value, 120);
    return said && SLUG.test(said) ? said : null;
}

function decodeOne(raw: unknown): ArkExtinction | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = text(row.species_profile_id, 40);
    const name = text(row.name);
    const at = text(row.at, 40);
    const arkDay = typeof row.ark_day === "number" ? row.ark_day : Number(row.ark_day);
    if (!id || !UUID.test(id) || !name || !at || !Number.isFinite(Date.parse(at)) || !Number.isFinite(arkDay) || arkDay < 0) return null;
    const cause = row.cause === "died_old" || row.cause === "eaten" || row.cause === "starved" ? row.cause : null;
    const eater = cause === "eaten" && row.eaten_by && typeof row.eaten_by === "object" ? (row.eaten_by as Record<string, unknown>) : null;
    const eaterId = eater ? text(eater.species_profile_id, 40) : null;
    const eaterName = eater ? text(eater.name) : null;
    const aboard = typeof row.aboard === "number" && Number.isFinite(row.aboard) ? Math.max(0, Math.floor(row.aboard)) : 0;
    return {
        speciesProfileId: id.toLowerCase(),
        name,
        scientificName: text(row.scientific_name),
        modelSlug: slug(row.model_slug),
        pageSlug: slug(row.page_slug),
        arkDay,
        at,
        cause,
        eatenBy: eaterId && UUID.test(eaterId) && eaterName ? {speciesProfileId: eaterId.toLowerCase(), name: eaterName, modelSlug: eater ? slug(eater.model_slug) : null} : null,
        aboard,
        // Only when the read says so and a living one is counted.
        backAboard: row.back_aboard === true && aboard > 0
    };
}

/**
 * `voyage_extinctions_v1`'s answer (or its `extinctions` array), checked: a malformed row is dropped, never the whole
 * list; one row per species (the newest), newest first. Null when the answer is not one at all.
 */
export function decodeArkExtinctions(raw: unknown): ArkExtinction[] | null {
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? (raw as {extinctions?: unknown}).extinctions : null;
    if (!Array.isArray(list)) return null;
    const bySpecies = new Map<string, ArkExtinction>();
    for (const item of list) {
        const one = decodeOne(item);
        if (!one) continue;
        const had = bySpecies.get(one.speciesProfileId);
        if (!had || Date.parse(one.at) > Date.parse(had.at)) bySpecies.set(one.speciesProfileId, one);
    }
    return Array.from(bySpecies.values()).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.arkDay - a.arkDay);
}

function fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

/** "13 Nov" in the reader's language (UTC, as the log is). */
export function arkExtinctDate(at: string, locale: string): string {
    const date = new Date(at);
    try {
        return new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", timeZone: "UTC"}).format(date);
    } catch {
        return new Intl.DateTimeFormat("en", {day: "numeric", month: "short", timeZone: "UTC"}).format(date);
    }
}

/** The Ark day as a whole day ("117"), in the reader's digits. */
export function arkExtinctDay(arkDay: number, locale: string): string {
    const day = Math.floor(arkDay);
    try {
        return day.toLocaleString(locale);
    } catch {
        return String(day);
    }
}

/** "Extinct on Ark day 117 · 13 Nov" (or another of the words' day/date templates). */
export function arkExtinctWhen(template: string, extinction: Pick<ArkExtinction, "arkDay" | "at">, locale: string): string {
    return fill(template, {day: arkExtinctDay(extinction.arkDay, locale), date: arkExtinctDate(extinction.at, locale)});
}

/** How the last one went, in a few words; null when the log did not say. */
export function arkExtinctHow(words: ArkLostWords, extinction: Pick<ArkExtinction, "cause" | "eatenBy">): string | null {
    switch (extinction.cause) {
        case "died_old":
            return words.diedOld;
        case "starved":
            return words.starved;
        case "eaten":
            return extinction.eatenBy ? fill(words.eatenBy, {animal: extinction.eatenBy.name}) : words.eaten;
        default:
            return null;
    }
}

const WEEK_MS = 7 * 86_400_000;

/** The newest species lost in the last week and still gone (the home line), or null. */
export function arkLostThisWeek(list: readonly ArkExtinction[], now = Date.now()): ArkExtinction | null {
    return list.find((one) => !one.backAboard && now - Date.parse(one.at) <= WEEK_MS && Date.parse(one.at) <= now + 60_000) ?? null;
}

/** One species' entry (by its species id, else its page slug), or null: never listed as lost unless logged. */
export function arkExtinctionOf(list: readonly ArkExtinction[] | null, species: {speciesProfileId?: string | null; slug?: string | null}): ArkExtinction | null {
    if (!list) return null;
    const id = species.speciesProfileId?.trim().toLowerCase() || null;
    const page = species.slug?.trim().toLowerCase() || null;
    return list.find((one) => (id && one.speciesProfileId === id) || (!id && page && one.pageSlug === page)) ?? null;
}

/** What `/api/ark/extinct` answers: the list, or `available: false` (no read yet: hide the section). */
export type ArkExtinctAnswer = {available: boolean; extinctions: ArkExtinction[]};

/** `/api/ark/extinct`, decoded; `available: false` on any failure (the section hides, never an invented list). */
export async function fetchArkExtinct(url = "/api/ark/extinct", fetcher: (url: string) => Promise<Response> = (asked) => fetch(asked)): Promise<ArkExtinctAnswer> {
    try {
        const response = await fetcher(url);
        if (!response.ok) return {available: false, extinctions: []};
        const body = (await response.json()) as {available?: unknown; extinctions?: unknown} | null;
        if (!body || body.available === false) return {available: false, extinctions: []};
        const list = decodeArkExtinctions(body.extinctions);
        return list ? {available: true, extinctions: list} : {available: false, extinctions: []};
    } catch {
        return {available: false, extinctions: []};
    }
}

/** The list for a host (the apps' `ark:extinct`): plain JSON, the read's own field names. */
export function arkExtinctForHost(answer: ArkExtinctAnswer) {
    return {
        available: answer.available,
        extinctions: answer.extinctions.map((one) => ({
            species_profile_id: one.speciesProfileId,
            name: one.name,
            scientific_name: one.scientificName,
            model_slug: one.modelSlug,
            page_slug: one.pageSlug,
            ark_day: one.arkDay,
            at: one.at,
            cause: one.cause,
            eaten_by: one.eatenBy ? {species_profile_id: one.eatenBy.speciesProfileId, name: one.eatenBy.name, model_slug: one.eatenBy.modelSlug} : null,
            aboard: one.aboard,
            back_aboard: one.backAboard
        }))
    };
}
