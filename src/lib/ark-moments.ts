/**
 * Ark moments in Discover, phase 1 (AnimalDex migration 20261202110000_ark_moments.sql; design
 * docs/ark/audits/ark-moments/README.md; client contract ~/AnimalDex-work/ark-moments-p1/CONTRACT.md).
 *
 * The server serves 0-2 moments once per feed session through `discover_feed_ark_moments_v1`: a row of the Ark's own
 * record (a first young, a first of a kind aboard, your animal's young, ...) with the slot it asks for. Everything the
 * card says is built here from the row's `kind` and `facts` only, in words from the locale files (`ark.moments.*`),
 * never gendered (the Ark records no sex). An unknown kind or a malformed row is skipped (forward compatible).
 */

import {fillArkWords} from "@/lib/ark-words";

export const ARK_MOMENT_OWN_KINDS = ["your_young", "your_first_aboard", "your_line"] as const;
export const ARK_MOMENT_PUBLIC_KINDS = ["first_young", "first_aboard", "new_generation", "species_milestone", "ark_milestone", "extinction"] as const;
export type ArkMomentKind = (typeof ARK_MOMENT_OWN_KINDS)[number] | (typeof ARK_MOMENT_PUBLIC_KINDS)[number];

const KINDS = new Set<string>([...ARK_MOMENT_OWN_KINDS, ...ARK_MOMENT_PUBLIC_KINDS]);

/** Never more than this many moment cards in one feed session. */
export const ARK_MOMENTS_PER_SESSION = 2;
/** At least this many organic cards between two injected items (a poll or a moment). */
export const ARK_MOMENT_SPACING = 8;

export type ArkMomentFacts = {
    young?: number;
    fromEgg?: boolean;
    generation?: number;
    mark?: number;
    firstArkDay?: number;
};

export type ArkMomentCredit = {displayName: string | null; handle: string | null};

export type ArkMoment = {
    id: string;
    kind: ArkMomentKind;
    tier: "own" | "public";
    /** Insert after this many organic cards (first 4..8, second 16..24). */
    slot: number;
    happenedAt: string | null;
    arkDay: number;
    speciesProfileId: string | null;
    speciesName: string | null;
    speciesSlug: string | null;
    modelSlug: string | null;
    zone: string | null;
    /** The living animal the Ark opens on and follows; null for extinction and ark_milestone. */
    focusAnimalId: string | null;
    facts: ArkMomentFacts;
    credit: ArkMomentCredit | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const int = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
const uuid = (value: unknown) => {
    const text = str(value);
    return text && UUID.test(text) ? text.toLowerCase() : null;
};

function parseFacts(value: unknown): ArkMomentFacts {
    const facts: ArkMomentFacts = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return facts;
    const raw = value as Record<string, unknown>;
    const young = int(raw.young);
    if (young !== null && young > 0) facts.young = young;
    if (typeof raw.from_egg === "boolean") facts.fromEgg = raw.from_egg;
    const generation = int(raw.generation);
    if (generation !== null && generation > 0) facts.generation = generation;
    const mark = int(raw.mark);
    if (mark !== null && mark > 0) facts.mark = mark;
    const firstArkDay = int(raw.first_ark_day);
    if (firstArkDay !== null && firstArkDay >= 0) facts.firstArkDay = firstArkDay;
    return facts;
}

function parseCredit(value: unknown): ArkMomentCredit | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const displayName = str(raw.display_name);
    const handle = str(raw.handle)?.replace(/^@+/, "") || null;
    return displayName || handle ? {displayName, handle} : null;
}

/** One `discover_feed_ark_moments_v1` row, or null when its kind is unknown or it lacks what its words need. */
export function parseArkMoment(row: unknown): ArkMoment | null {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    const id = uuid(r.moment_id);
    const kind = str(r.kind);
    const arkDay = int(r.ark_day);
    if (!id || !kind || !KINDS.has(kind) || arkDay === null || arkDay < 0) return null;
    const own = (ARK_MOMENT_OWN_KINDS as readonly string[]).includes(kind);
    const facts = parseFacts(r.facts);
    const speciesName = str(r.species_name);
    // What each kind's words need: a species name (all but the Ark's total), a generation, a count.
    if (kind !== "ark_milestone" && !speciesName) return null;
    if ((kind === "your_line" || kind === "new_generation") && facts.generation === undefined) return null;
    if ((kind === "species_milestone" || kind === "ark_milestone") && facts.mark === undefined) return null;
    const slot = int(r.slot);
    return {
        id,
        kind: kind as ArkMomentKind,
        // The tier follows the kind: an own kind is only ever the viewer's own news.
        tier: own ? "own" : "public",
        slot: slot !== null && slot >= 4 ? slot : 4,
        happenedAt: str(r.happened_at) && Number.isFinite(Date.parse(String(r.happened_at))) ? String(r.happened_at) : null,
        arkDay,
        speciesProfileId: uuid(r.species_profile_id),
        speciesName,
        speciesSlug: str(r.species_slug),
        modelSlug: str(r.model_slug),
        zone: str(r.zone),
        focusAnimalId: kind === "extinction" || kind === "ark_milestone" ? null : uuid(r.focus_animal_id),
        facts,
        // A credit belongs to public rows only.
        credit: own ? null : parseCredit(r.credit)
    };
}

/** The session's moments: valid rows only, each once, own first then by slot, at most two. */
export function parseArkMoments(rows: unknown): ArkMoment[] {
    if (!Array.isArray(rows)) return [];
    const seen = new Set<string>();
    const out: ArkMoment[] = [];
    for (const row of rows) {
        const moment = parseArkMoment(row);
        if (!moment || seen.has(moment.id)) continue;
        seen.add(moment.id);
        out.push(moment);
    }
    out.sort((a, b) => (a.tier === b.tier ? a.slot - b.slot : a.tier === "own" ? -1 : 1));
    return out.slice(0, ARK_MOMENTS_PER_SESSION);
}

/**
 * What `discover_feed_ark_moments_v1` answered, as the route hands it to the page: the rows, or none. Any error, and in
 * particular a server without the migration (PGRST202 / 42883 / 404), is no moments: no card, no error.
 */
export function arkMomentRowsFromRpc(data: unknown, error: {code?: string | null; message?: string | null} | null | undefined): unknown[] {
    if (error) return [];
    return Array.isArray(data) ? data.slice(0, 8) : [];
}

// ---- placement (the same rule on iOS, Android and the web)

export type PlacedArkMoment = {moment: ArkMoment; slot: number};

/**
 * Where each moment goes. The poll (when the session has one) keeps its slot; then each moment in slot order starts at
 * its own slot and, while an already placed injected item p is within 8 of it (|s - p| < 8), moves to p + 8. At most two.
 * Whether a slot is reached by the loaded feed is `placeArkMoments`' business, so the plan never shifts as pages load.
 */
export function planArkMomentSlots(moments: readonly ArkMoment[], pollSlot: number | null): PlacedArkMoment[] {
    const taken: number[] = pollSlot !== null && Number.isFinite(pollSlot) ? [pollSlot] : [];
    const placed: PlacedArkMoment[] = [];
    const ordered = [...moments].sort((a, b) => a.slot - b.slot).slice(0, ARK_MOMENTS_PER_SESSION);
    for (const moment of ordered) {
        let slot = Math.max(4, moment.slot);
        for (let guard = 0; guard < 16; guard += 1) {
            const near = taken.find((p) => Math.abs(slot - p) < ARK_MOMENT_SPACING);
            if (near === undefined) break;
            slot = near + ARK_MOMENT_SPACING;
        }
        taken.push(slot);
        placed.push({moment, slot});
    }
    return placed;
}

/**
 * The feed's slots with each planned moment after `slot` organic posts. A moment whose slot is beyond the posts loaded
 * is left out (and so never marked seen) until the feed reaches it. Other slot kinds (debates, the poll) stay in place.
 */
export function placeArkMoments<T extends {kind: string}>(slots: T[], planned: readonly PlacedArkMoment[], make: (moment: ArkMoment) => T): T[] {
    if (planned.length === 0 || slots.length === 0) return slots;
    const after = new Map<number, ArkMoment[]>();
    for (const {moment, slot} of planned) after.set(slot, [...(after.get(slot) ?? []), moment]);
    const out: T[] = [];
    let posts = 0;
    for (const slot of slots) {
        out.push(slot);
        if (slot.kind !== "post") continue;
        posts += 1;
        for (const moment of after.get(posts) ?? []) out.push(make(moment));
    }
    return out;
}

// ---- words

export type ArkMomentWords = {
    label: string;
    notNow: string;
    seeInArk: string;
    openArk: string;
    yourYoung: string;
    yourFirstAboard: string;
    yourLine: string;
    firstYoungHatched: string;
    firstYoungBorn: string;
    firstAboard: string;
    newGeneration: string;
    speciesMilestone: string;
    arkMilestone: string;
    extinction: string;
    youngHatched: string;
    youngBorn: string;
    cameAboardOnDay: string;
    arkDay: string;
    broughtBy: string;
    fromLine: string;
};

/** English, the source (`ark.moments` in src/data/locales/en.json says the same). */
export const ARK_MOMENT_ENGLISH: ArkMomentWords = {
    label: "Ark",
    notNow: "Not now",
    seeInArk: "See it in the Ark",
    openArk: "Open the Ark",
    yourYoung: "Your {species} is a parent",
    yourFirstAboard: "Your {species} is the first of its kind on the Ark",
    yourLine: "Your {species}'s line reached generation {generation}",
    firstYoungHatched: "First {species} young hatched on the Ark",
    firstYoungBorn: "First {species} young born on the Ark",
    firstAboard: "The first {species} came aboard the Ark",
    newGeneration: "Generation {generation} is born on the Ark",
    speciesMilestone: "{species}: {count} now aboard the Ark",
    arkMilestone: "{count} animals now aboard the Ark",
    extinction: "The last {species} on the Ark has died",
    youngHatched: "{count} young hatched",
    youngBorn: "{count} young born",
    cameAboardOnDay: "It came aboard on day {day}.",
    arkDay: "Ark day {day}",
    broughtBy: "Brought aboard by {name}",
    fromLine: "From {name}'s line"
};

/** `ark.moments` from a locale file's messages, English key by key where one is missing. */
export function arkMomentWords(messages: unknown): ArkMomentWords {
    const ark = messages && typeof messages === "object" ? (messages as {ark?: {moments?: unknown}}).ark : undefined;
    const raw = ark?.moments && typeof ark.moments === "object" ? (ark.moments as Record<string, unknown>) : {};
    const out = {...ARK_MOMENT_ENGLISH};
    for (const key of Object.keys(out) as (keyof ArkMomentWords)[]) {
        const value = raw[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

export type ArkMomentCaption = {title: string; facts: string; credit: string | null};

/** The card's three lines from the row only: title, facts (joined with " · "), and the credit for a named bringer. */
export function arkMomentCaption(moment: ArkMoment, words: ArkMomentWords, locale: string): ArkMomentCaption {
    const number = (value: number) => {
        try {
            return new Intl.NumberFormat(locale).format(value);
        } catch {
            return String(value);
        }
    };
    const species = moment.speciesName ?? "";
    const {facts} = moment;
    const fill = (template: string, values: Record<string, string | number> = {}) => fillArkWords(template, {species, ...values});
    const titles: Record<ArkMomentKind, () => string> = {
        your_young: () => fill(words.yourYoung),
        your_first_aboard: () => fill(words.yourFirstAboard),
        your_line: () => fill(words.yourLine, {generation: number(facts.generation ?? 0)}),
        first_young: () => fill(facts.fromEgg ? words.firstYoungHatched : words.firstYoungBorn),
        first_aboard: () => fill(words.firstAboard),
        new_generation: () => fill(words.newGeneration, {generation: number(facts.generation ?? 0)}),
        species_milestone: () => fill(words.speciesMilestone, {count: number(facts.mark ?? 0)}),
        ark_milestone: () => fill(words.arkMilestone, {count: number(facts.mark ?? 0)}),
        extinction: () => fill(words.extinction)
    };
    const parts: string[] = [];
    if ((moment.kind === "your_young" || moment.kind === "first_young") && facts.young !== undefined) {
        parts.push(fill(facts.fromEgg ? words.youngHatched : words.youngBorn, {count: number(facts.young)}));
    }
    if (moment.kind === "new_generation" && species) parts.push(species);
    if (moment.kind === "extinction" && facts.firstArkDay !== undefined) parts.push(fill(words.cameAboardOnDay, {day: number(facts.firstArkDay)}));
    parts.push(fill(words.arkDay, {day: number(moment.arkDay)}));
    let credit: string | null = null;
    if (moment.tier === "public" && moment.credit) {
        const name = moment.credit.displayName ?? `@${moment.credit.handle}`;
        credit = fillArkWords(moment.kind === "first_aboard" ? words.broughtBy : words.fromLine, {name});
    }
    return {title: titles[moment.kind](), facts: parts.join(" · "), credit};
}

/** The button: the Ark opened on the animal and following it, or the plain Ark (locale-prefixed by the app's Link). */
export function arkMomentHref(moment: ArkMoment): string {
    return moment.focusAnimalId ? `/ark?focus=${encodeURIComponent(moment.focusAnimalId)}&follow=1` : "/ark";
}

/** "2 h ago" in the reader's language; null without a time. */
export function arkMomentAgo(happenedAt: string | null, locale: string, now: number = Date.now()): string | null {
    if (!happenedAt) return null;
    const at = Date.parse(happenedAt);
    if (!Number.isFinite(at)) return null;
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    let format: Intl.RelativeTimeFormat;
    try {
        format = new Intl.RelativeTimeFormat(locale, {numeric: "auto", style: "short"});
    } catch {
        format = new Intl.RelativeTimeFormat("en", {numeric: "auto", style: "short"});
    }
    if (seconds < 3600) return format.format(-Math.max(1, Math.round(seconds / 60)), "minute");
    if (seconds < 86400) return format.format(-Math.round(seconds / 3600), "hour");
    return format.format(-Math.round(seconds / 86400), "day");
}
