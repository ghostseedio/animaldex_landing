/**
 * Endangered now (audit docs/ark/audits/ecosystem-audit-2026-11-18.md §3, §5 P0-8; owner decision 389): the kinds in an
 * open wild crisis, as the server committed them (`voyage_crises`, read through `/api/ark/crises`). Contract:
 * AnimalDex docs/ark/audits/ecosystem/crises-api-contract.md.
 *
 * The read does not exist yet (E4 builds it), so this is written against the contract: a 404, `available: false` or an
 * empty list is the calm empty state; a transport error or 5xx is "can't check right now", never the empty state.
 *
 * Truthful and without look-ahead: only what the answer says (a count, a band, when the crisis opened); no predator,
 * no estimate, no guess. Crisis kinds only (a lone founder has no crisis row). Country level only (never a place).
 *
 * Plain functions, no DOM: the /ark/endangered page and its tests share them. The same shapes are decoded in the iOS and
 * Android clients.
 */

export type ArkCrisisBand = "critical" | "last";
export type ArkCrisisStatus = "open" | "saved" | "extinct";

export type ArkCrisis = {
    id: string;
    speciesProfileId: string;
    name: string;
    scientificName: string | null;
    /** The Ark icon's slug (`animals/<slug>.webp`); null: the generic figure. */
    modelSlug: string | null;
    /** The species page's slug (`/animals/<slug>`); null: no page. */
    pageSlug: string | null;
    band: ArkCrisisBand;
    status: ArkCrisisStatus;
    /** Living, non-recovering wild animals of the kind as of the answer. */
    wildCount: number;
    openedArkDay: number | null;
    /** When the crisis opened (ISO, real time). */
    openedAt: string;
    endedArkDay: number | null;
    endedAt: string | null;
    /** The wild animals alive now (0..2), for "See it in the Ark". */
    lastAnimalIds: string[];
    habitat: string | null;
    /** ISO 3166-1 alpha-2 codes, upper case; country level only. */
    countries: string[];
    /**
     * Contract 1.1 (P1-2): who saved it, on a saved crisis an arrival in the wild ended; null on every other row. Name
     * only: `name` is a public display name, or null for "a collector" (a person who is not to be named, or is gone).
     * Never an id, handle, link or place: the server decides who is named, the client only says it.
     */
    savedBy: ArkCrisisSaver[] | null;
};

export type ArkCrisisSaver = {name: string | null};

/** The page's words (`ark.endangered` in the locale files). */
export type ArkEndangeredWords = {
    /** "Endangered now" */
    title: string;
    /** What the list is, under its title. */
    intro: string;
    /** "No kind is in danger right now" */
    empty: string;
    /** One calm line under the empty state. */
    emptyHint: string;
    /** "Critical" (2 left) */
    critical: string;
    /** "Last one" (1 left) */
    last: string;
    /** "In the wild: {count}" */
    wildCount: string;
    /** "In danger for {duration}" */
    openFor: string;
    habitat: string;
    /** "Found in" */
    foundIn: string;
    /** "Saved: this kind is out of danger" */
    saved: string;
    /** "Saved by {name}" (a named saver; never gendered) */
    savedBy: string;
    /** "Saved by a collector" (a saver who is not named) */
    savedByCollector: string;
    /** "Lost from the wild" */
    lost: string;
    /** The list, for a screen reader. */
    listLabel: string;
    /** "Can't check right now. Try again in a moment." */
    unavailable: string;
    /** "See it in the Ark" */
    seeInArk: string;
    retry: string;
};

export const ARK_ENDANGERED_WORDS_EN: ArkEndangeredWords = {
    title: "Endangered now",
    intro: "Kinds with only one or two left in the wild.",
    empty: "No kind is in danger right now",
    emptyHint: "If a kind falls to two or one in the wild, it will be listed here.",
    critical: "Critical",
    last: "Last one",
    wildCount: "In the wild: {count}",
    openFor: "In danger for {duration}",
    habitat: "Habitat",
    foundIn: "Found in",
    saved: "Saved: this kind is out of danger",
    savedBy: "Saved by {name}",
    savedByCollector: "Saved by a collector",
    lost: "Lost from the wild",
    listLabel: "Kinds in danger in the wild, newest first",
    unavailable: "Can't check right now. Try again in a moment.",
    seeInArk: "See it in the Ark",
    retry: "Try again"
};

/** The words as a locale has them, English key by key where one is missing. */
export function arkEndangeredWords(raw: unknown): ArkEndangeredWords {
    const given = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const out = {...ARK_ENDANGERED_WORDS_EN};
    for (const key of Object.keys(out) as (keyof ArkEndangeredWords)[]) {
        const value = given[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

/** The page and its deep link. */
export const ARK_ENDANGERED_PATH = "/ark/endangered";
export const ARK_CRISES_API = "/api/ark/crises";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY = /^[A-Z]{2}$/;

function text(value: unknown, max = 200): string | null {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function slug(value: unknown): string | null {
    const said = text(value, 120);
    return said && SLUG.test(said) ? said : null;
}

function uuid(value: unknown): string | null {
    const said = text(value, 40);
    return said && UUID.test(said) ? said.toLowerCase() : null;
}

function num(value: unknown): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function iso(value: unknown): string | null {
    const said = text(value, 40);
    return said && Number.isFinite(Date.parse(said)) ? said : null;
}

/** A display name as the card shows it: control characters and runs of spaces are one space, at most 40 characters. */
export function arkCrisisSaverName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    // Control characters and the bidi overrides and isolates (a name must not reorder the line around it); joiners stay (they are part of some scripts).
    const clean = value.replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069\s]+/gu, " ").trim();
    if (!clean) return null;
    return Array.from(clean).slice(0, 40).join("").trim() || null;
}

/** `saved_by`, checked: a list of `{name}` (at most 3), only on a saved crisis; anything else is not shown. */
function decodeSavedBy(value: unknown, status: ArkCrisisStatus): ArkCrisisSaver[] | null {
    if (status !== "saved" || !Array.isArray(value)) return null;
    const savers = value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .slice(0, 3)
        .map((item) => ({name: arkCrisisSaverName(item.name)}));
    return savers.length ? savers : null;
}

function decodeOne(raw: unknown): ArkCrisis | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = uuid(row.id);
    const speciesProfileId = uuid(row.species_profile_id);
    const name = text(row.name);
    const openedAt = iso(row.opened_at);
    if (!id || !speciesProfileId || !name || !openedAt) return null;
    const said = row.status;
    const status: ArkCrisisStatus | null = said === undefined || said === null || said === "open" ? "open" : said === "saved" || said === "extinct" ? said : null;
    if (!status) return null;
    const band = row.band === "critical" || row.band === "last" ? row.band : null;
    const count = num(row.wild_count);
    if (!band || count === null) return null;
    const wildCount = Math.floor(count);
    // An open crisis is exactly 2 left (critical) or 1 left (last): anything else is not a crisis row, never shown.
    if (status === "open" && wildCount !== (band === "last" ? 1 : 2)) return null;
    if (status === "extinct" && wildCount !== 0) return null;
    const lastAnimalIds = Array.isArray(row.last_animal_ids) ? Array.from(new Set(row.last_animal_ids.map(uuid).filter((one): one is string => Boolean(one)))).slice(0, 2) : [];
    const countries = Array.isArray(row.countries) ? Array.from(new Set(row.countries.map((one) => (typeof one === "string" ? one.trim().toUpperCase() : "")).filter((one) => COUNTRY.test(one)))).slice(0, 8) : [];
    return {
        id,
        speciesProfileId,
        name,
        scientificName: text(row.scientific_name),
        modelSlug: slug(row.model_slug),
        pageSlug: slug(row.page_slug),
        band,
        status,
        wildCount,
        openedArkDay: num(row.opened_ark_day),
        openedAt,
        endedArkDay: num(row.ended_ark_day),
        endedAt: iso(row.ended_at),
        lastAnimalIds,
        habitat: text(row.habitat, 160),
        countries,
        savedBy: decodeSavedBy(row.saved_by, status)
    };
}

/** Open crises first (the last one before critical, then the newest), then ended ones (the newest). */
export function sortArkCrises(list: readonly ArkCrisis[]): ArkCrisis[] {
    const rank = (one: ArkCrisis) => (one.status !== "open" ? 2 : one.band === "last" ? 0 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b) || Date.parse(b.openedAt) - Date.parse(a.openedAt) || a.id.localeCompare(b.id));
}

/**
 * The answer's `crises` array (or the answer), checked: a malformed row is dropped, never the whole list; one row per
 * crisis id (the newest `opened_at` wins); in the contract's order. Null when it is not an answer at all.
 */
export function decodeArkCrises(raw: unknown): ArkCrisis[] | null {
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? (raw as {crises?: unknown}).crises : null;
    if (!Array.isArray(list)) return null;
    const byId = new Map<string, ArkCrisis>();
    for (const item of list) {
        const one = decodeOne(item);
        if (!one) continue;
        const had = byId.get(one.id);
        if (!had || Date.parse(one.openedAt) > Date.parse(had.openedAt)) byId.set(one.id, one);
    }
    return sortArkCrises(Array.from(byId.values()));
}

/** `ready`: an answer (the list may be empty); `absent`: the read does not exist yet (404, `available: false`); `error`: could not ask. */
export type ArkCrisesAnswer = {state: "ready" | "absent" | "error"; crises: ArkCrisis[]};

export function arkCrisesUrl(options: {crisis?: string | null; lang?: string | null} = {}, base = ARK_CRISES_API): string {
    const params = new URLSearchParams();
    const crisis = options.crisis ? uuid(options.crisis) : null;
    if (crisis) params.set("crisis", crisis);
    if (options.lang) params.set("lang", options.lang.slice(0, 35));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
}

/** `/api/ark/crises`, decoded. Every failure is a state, never a throw. */
export async function fetchArkCrises(options: {crisis?: string | null; lang?: string | null} = {}, fetcher: (url: string) => Promise<Response> = (asked) => fetch(asked, {cache: "no-store"})): Promise<ArkCrisesAnswer> {
    try {
        const response = await fetcher(arkCrisesUrl(options));
        if (response.status === 404 || response.status === 410 || response.status === 501) return {state: "absent", crises: []};
        if (!response.ok) return {state: "error", crises: []};
        const body = (await response.json()) as {available?: unknown; crises?: unknown} | null;
        if (!body || typeof body !== "object") return {state: "error", crises: []};
        if (body.available === false) return {state: "absent", crises: []};
        const list = decodeArkCrises(body.crises);
        return list ? {state: "ready", crises: list} : {state: "error", crises: []};
    } catch {
        return {state: "error", crises: []};
    }
}

// MARK: Showing one

/** The crisis's own words: "Critical", "Last one". */
export function arkCrisisBandWord(words: Pick<ArkEndangeredWords, "critical" | "last">, crisis: Pick<ArkCrisis, "band">): string {
    return crisis.band === "last" ? words.last : words.critical;
}

/**
 * How long the crisis has been open, as one rounded-down unit in the reader's language ("12 minutes", "5 hours",
 * "3 days"): minutes under an hour, hours under two days, days after. Never less than a minute. The thresholds are the
 * same in the iOS and Android clients.
 */
export function arkCrisisDuration(openedAt: string, now: number, locale: string): string {
    const opened = Date.parse(openedAt);
    const elapsed = Number.isFinite(opened) ? Math.max(0, now - opened) : 0;
    const minutes = Math.max(1, Math.floor(elapsed / 60_000));
    const [unit, value] = minutes < 60 ? ["minute", minutes] : minutes < 48 * 60 ? ["hour", Math.floor(minutes / 60)] : ["day", Math.floor(minutes / (24 * 60))];
    const format = (language: string) => new Intl.NumberFormat(language, {style: "unit", unit, unitDisplay: "long"}).format(value);
    try {
        return format(locale);
    } catch {
        return format("en");
    }
}

/** Country names in the reader's language, from the codes; a code the runtime does not know stays as the code. */
export function arkCrisisCountries(codes: readonly string[], locale: string): string[] {
    let names: Intl.DisplayNames | null = null;
    try {
        names = new Intl.DisplayNames([locale], {type: "region"});
    } catch {
        try {
            names = new Intl.DisplayNames(["en"], {type: "region"});
        } catch {
            names = null;
        }
    }
    // A code the runtime does not know answers "Unknown Region" (the same as for "ZZ"): the code stays instead.
    let unknown: string | undefined;
    try {
        unknown = names?.of("ZZ");
    } catch {
        unknown = undefined;
    }
    return codes.map((code) => {
        try {
            const name = names?.of(code);
            return name && name !== unknown ? name : code;
        } catch {
            return code;
        }
    });
}

/** What "See it in the Ark" flies to: an animal that is alive now, else the kind. Null for an extinct crisis. */
export function arkCrisisFocus(crisis: Pick<ArkCrisis, "status" | "lastAnimalIds" | "speciesProfileId">): string | null {
    if (crisis.status === "extinct") return null;
    return crisis.lastAnimalIds[0] ?? crisis.speciesProfileId;
}

/** The Ark link for "See it in the Ark": `/ark?focus=<animal id>&follow=1` (the capture's button says the same). */
export function arkCrisisSeeItPath(crisis: Pick<ArkCrisis, "status" | "lastAnimalIds" | "speciesProfileId">): string | null {
    const focus = arkCrisisFocus(crisis);
    if (!focus) return null;
    return crisis.lastAnimalIds[0] ? `/ark?focus=${encodeURIComponent(focus)}&follow=1` : `/ark?focus=${encodeURIComponent(focus)}`;
}

/** The deep link to one crisis. */
export function arkCrisisLink(id: string): string {
    return `${ARK_ENDANGERED_PATH}?crisis=${encodeURIComponent(id)}`;
}

/** `?crisis=<id>` of an address, when it is a crisis id. */
export function arkCrisisFromQuery(value: unknown): string | null {
    return typeof value === "string" ? uuid(value) : null;
}

/**
 * "Saved by Maya R." or "Saved by a collector": the credit under a saved crisis's headline, or null when the answer names
 * no saver (a birth or a mate's return ended it, or the server sent none). A name is wrapped in direction isolates so
 * a right-to-left name in a left-to-right line (and the reverse) reads whole. Never a link: a name is only a name.
 */
export function arkCrisisSavedByLine(words: Pick<ArkEndangeredWords, "savedBy" | "savedByCollector">, crisis: Pick<ArkCrisis, "status" | "savedBy">, locale: string): string | null {
    if (crisis.status !== "saved" || !crisis.savedBy?.length) return null;
    const names = crisis.savedBy.map((one) => one.name).filter((one): one is string => Boolean(one));
    if (!names.length) return words.savedByCollector;
    const isolated = names.map((name) => `\u2068${name}\u2069`);
    let list = isolated.join(", ");
    try {
        list = new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(isolated);
    } catch {
        // a runtime with no ListFormat for this language: the plain list
    }
    return words.savedBy.replace("{name}", list);
}

/** The list's line for a screen reader and a plain-text view: "Wild Boar, Last one, In the wild: 1, In danger for 5 hours". */
export function arkCrisisSummary(words: ArkEndangeredWords, crisis: ArkCrisis, now: number, locale: string): string {
    const parts = [crisis.name];
    if (crisis.status === "saved") {
        parts.push(words.saved);
        const credit = arkCrisisSavedByLine(words, crisis, locale);
        if (credit) parts.push(credit);
    } else if (crisis.status === "extinct") parts.push(words.lost);
    else {
        parts.push(arkCrisisBandWord(words, crisis));
        parts.push(words.wildCount.replace("{count}", crisis.wildCount.toLocaleString(locale)));
        parts.push(words.openFor.replace("{duration}", arkCrisisDuration(crisis.openedAt, now, locale)));
    }
    return parts.join(", ");
}
