/**
 * Hearts are lives in the Ark (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md, section 6), the web's side. Pure.
 *
 * - The card's hearts (`captures.challenge_health`, 0..3) are the lives of the animal that card brought aboard, while
 *   its bringer still holds it. An animal that dies with a heart left spends one and is away for a day (`recovering`:
 *   absent from the scene), then walks out of its home again (`revived`).
 * - The owner reads their own animals' hearts through `/api/ark/hearts` (`ArkOwnerHearts`), and only while the
 *   server's `ark_hearts` switch is on: with it off, or with the server's columns absent, the read is `null` and
 *   nothing here shows.
 * - A heart is restored with the existing path (`/api/app/hearts`, `heal_capture_heart_v1`: 5 Credits).
 *
 * Privacy: the owner's own animals only; never anyone else's card or Credits.
 */

import {fillArkWords} from "@/lib/ark-words";
import {arkHeartsEscape, arkHeartsVariant, decodeArkHeartsRules, type ArkHeartsRules} from "@/lib/ark-hearts-rules";

export const ARK_HEARTS_MAX = 3;
export const ARK_HEART_COST = 5;
/** 1 Ark year is 14 real days (the server's clock, `ark_hearts_when`). */
export const ARK_DAY_MS = (14 / 365) * 86_400_000;

/** What a recovery is from. With the escape rule on: `eaten` a hunt it survived, `starved` found weak and taken into care, `deforested` its home lost to logging. */
export type ArkRecoverCause = "eaten" | "starved" | "died_old" | "deforested";

/** One of the owner's animals with a card: its hearts, and while away, when it returns. */
export type ArkAnimalHearts = {
    id: string;
    /** The card that brought it (the one a heart is restored on). */
    captureId: string;
    hearts: number;
    status: "present" | "recovering";
    /** Recovering: when it is back (ISO), from the server's Ark day and the voyage's start. */
    returnsAt: string | null;
    cause: ArkRecoverCause | null;
    revives: number;
    /** Recovering animals are not in the snapshot: the read names them. */
    name: string | null;
    modelSlug: string | null;
};

export type ArkOwnerHearts = {
    /** The restore's price (`debates_config_v1().heal_cost`, 5 today). */
    healCost: number;
    animals: Record<string, ArkAnimalHearts>;
    /** Which rule the server runs (`/api/ark/hearts`'s `rules`): null from a server that does not say, which is today's rule. */
    rules?: ArkHeartsRules | null;
};

/** The card's and the scene's words (`ark.hearts` in the locale files). */
export type ArkHeartsWords = {
    livesOne: string;
    livesOther: string;
    livesNone: string;
    label: string;
    recovering: string;
    whenHour: string;
    whenHours: string;
    whenTomorrow: string;
    whenDays: string;
    restore: string;
    restoring: string;
    note: string;
    noCredits: string;
    getCredits: string;
    failed: string;
    recoveringOne: string;
    recoveringOther: string;
    away: string;
    /**
     * A heart is a survived attack (`hearts_escape` on, docs/ark/hearts-escape.md): the words that take the lives' place while
     * it is. `escapeNote` says old age is final, `escapeNoteOld` that it still returns (`hearts_escape_rules.oldAge`).
     * The three `recovering*` are the chip for what the heart was spent surviving.
     */
    escapeLivesOne: string;
    escapeLivesOther: string;
    escapeLivesNone: string;
    escapeNote: string;
    escapeNoteOld: string;
    recoveringWounded: string;
    recoveringCare: string;
    recoveringHome: string;
};

/** The words once the rule is read (`arkHeartsWords`): the chip's variants by cause, set only while a heart is a survived attack. */
export type ArkHeartsWordsFor = ArkHeartsWords & {recoveringByCause?: Partial<Record<ArkRecoverCause, string>>};

export const ARK_HEARTS_ENGLISH: ArkHeartsWords = {
    livesOne: "1 life in the Ark",
    livesOther: "{n} lives in the Ark",
    livesNone: "No lives left in the Ark",
    label: "{n} of 3 hearts",
    recovering: "Recovering · returns {when}",
    whenHour: "within the hour",
    whenHours: "in about {n} hours",
    whenTomorrow: "tomorrow",
    whenDays: "in {n} days",
    restore: "Restore a heart · {credits} Credits",
    restoring: "Restoring…",
    note: "Each heart is one more life for your animal in the Ark.",
    noCredits: "You need {credits} Credits to restore a heart.",
    getCredits: "Get Credits",
    failed: "That didn't go through. Try again in a moment.",
    recoveringOne: "1 recovering",
    recoveringOther: "{count} recovering",
    away: "It's away while it recovers, then walks out of its home again.",
    escapeLivesOne: "1 heart in the Ark",
    escapeLivesOther: "{n} hearts in the Ark",
    escapeLivesNone: "No hearts left in the Ark",
    escapeNote: "Each heart lets your animal survive one attack or one hungry spell in the Ark. Hearts can't hold back old age.",
    escapeNoteOld: "Each heart lets your animal survive one attack or one hungry spell in the Ark. A heart also brings it back from old age as a young adult.",
    recoveringWounded: "Lying up, wounded · returns {when}",
    recoveringCare: "In the town's care · returns {when}",
    recoveringHome: "Lost its home · returns {when}"
};

/**
 * The reader's `ark.hearts` over English, key by key. With `rules` saying a heart is a survived attack, the `escape*` words
 * take the lives' place (hearts, the note, and the chip by cause); without them (the switch off, a server that does not say)
 * the words are exactly the lives' as they were.
 */
export function arkHeartsWords(raw: Partial<ArkHeartsWords> | null | undefined, rules?: ArkHeartsRules | null): ArkHeartsWordsFor {
    const out: ArkHeartsWordsFor = {...ARK_HEARTS_ENGLISH};
    if (raw && typeof raw === "object") {
        for (const key of Object.keys(ARK_HEARTS_ENGLISH) as Array<keyof ArkHeartsWords>) {
            const value = raw[key];
            if (typeof value === "string" && value.trim()) out[key] = value;
        }
    }
    if (!arkHeartsEscape(rules)) return out;
    out.livesOne = out.escapeLivesOne;
    out.livesOther = out.escapeLivesOther;
    out.livesNone = out.escapeLivesNone;
    out.note = arkHeartsVariant(rules, out.note, out.escapeNote, out.escapeNoteOld);
    out.recoveringByCause = {eaten: out.recoveringWounded, starved: out.recoveringCare, deforested: out.recoveringHome};
    return out;
}

export function clampArkHearts(value: unknown): number {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : ARK_HEARTS_MAX;
    return Math.min(Math.max(n, 0), ARK_HEARTS_MAX);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAUSES = new Set<ArkRecoverCause>(["eaten", "starved", "died_old", "deforested"]);

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number): string | null {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** `/api/ark/hearts`'s `hearts`, checked: null (off, absent, signed out) or the owner's animals; a bad row is dropped. `rules`: its `rules`. */
export function decodeArkOwnerHearts(raw: unknown, rulesRaw?: unknown): ArkOwnerHearts | null {
    const row = record(raw);
    const animals = record(row?.animals);
    if (!row || !animals) return null;
    const out: Record<string, ArkAnimalHearts> = {};
    for (const [id, value] of Object.entries(animals)) {
        const item = record(value);
        const captureId = text(item?.captureId, 40);
        if (!item || !UUID.test(id) || !captureId || !UUID.test(captureId)) continue;
        const status = item.status === "recovering" ? "recovering" : item.status === "present" ? "present" : null;
        if (!status) continue;
        const returnsAt = text(item.returnsAt, 40);
        const cause = text(item.cause, 20);
        out[id.toLowerCase()] = {
            id: id.toLowerCase(),
            captureId: captureId.toLowerCase(),
            hearts: clampArkHearts(item.hearts),
            status,
            returnsAt: returnsAt && !Number.isNaN(Date.parse(returnsAt)) ? returnsAt : null,
            cause: cause && CAUSES.has(cause as ArkRecoverCause) ? cause as ArkRecoverCause : null,
            revives: typeof item.revives === "number" && Number.isFinite(item.revives) ? Math.max(Math.round(item.revives), 0) : 0,
            name: text(item.name, 120),
            modelSlug: text(item.modelSlug, 120)
        };
    }
    const cost = typeof row.healCost === "number" && Number.isFinite(row.healCost) && row.healCost > 0 ? Math.round(row.healCost) : ARK_HEART_COST;
    const rules = decodeArkHeartsRules(rulesRaw);
    return {healCost: cost, animals: out, ...(rules ? {rules} : {})};
}

/** The real time an Ark day falls on (the voyage started at `startedAt`): the server's own rule. */
export function arkDayToTime(startedAt: string | number, arkDay: number): number | null {
    const start = typeof startedAt === "number" ? startedAt : Date.parse(startedAt);
    if (!Number.isFinite(start) || !Number.isFinite(arkDay)) return null;
    return start + arkDay * ARK_DAY_MS;
}

/** "within the hour", "in about 5 hours", "tomorrow", "in 2 days": the notices' rule (`ark_hearts_when`), in the reader's words. */
export function arkHeartsWhen(returnsAt: string | number, now: number, words: ArkHeartsWords, locale = "en"): string {
    const at = typeof returnsAt === "number" ? returnsAt : Date.parse(returnsAt);
    const hours = Number.isFinite(at) ? (at - now) / 3_600_000 : 24;
    if (hours < 1) return words.whenHour;
    if (hours < 20) return fillArkWords(words.whenHours, {n: Math.round(hours).toLocaleString(locale)});
    if (hours < 36) return words.whenTomorrow;
    return fillArkWords(words.whenDays, {n: Math.round(hours / 24).toLocaleString(locale)});
}

/** "3 lives in the Ark", "1 life in the Ark", "No lives left in the Ark". */
export function arkLivesText(hearts: number, words: ArkHeartsWords, locale = "en"): string {
    const n = clampArkHearts(hearts);
    if (n <= 0) return words.livesNone;
    if (n === 1) return words.livesOne;
    return fillArkWords(words.livesOther, {n: n.toLocaleString(locale)});
}

/** "Recovering · returns tomorrow"; with a heart a survived attack, what it survived: "Lying up, wounded · returns tomorrow". */
export function arkRecoveringText(entry: Pick<ArkAnimalHearts, "returnsAt"> & Partial<Pick<ArkAnimalHearts, "cause">>, now: number, words: ArkHeartsWordsFor, locale = "en"): string {
    const chip = (entry.cause ? words.recoveringByCause?.[entry.cause] : null) ?? words.recovering;
    return fillArkWords(chip, {when: entry.returnsAt ? arkHeartsWhen(entry.returnsAt, now, words, locale) : words.whenTomorrow});
}

/** The restore button shows whenever the card is below 3. */
export function arkCanRestoreHeart(entry: Pick<ArkAnimalHearts, "hearts"> | null | undefined): boolean {
    return Boolean(entry) && clampArkHearts(entry!.hearts) < ARK_HEARTS_MAX;
}

/** The owner's animals away now, the soonest back first. */
export function arkRecoveringAnimals(hearts: ArkOwnerHearts | null): ArkAnimalHearts[] {
    if (!hearts) return [];
    return Object.values(hearts.animals)
        .filter((entry) => entry.status === "recovering")
        .sort((a, b) => (a.returnsAt ? Date.parse(a.returnsAt) : Infinity) - (b.returnsAt ? Date.parse(b.returnsAt) : Infinity) || a.id.localeCompare(b.id));
}

/** A heart restored: the read with that card's hearts raised (every animal it brought). */
export function arkWithHearts(hearts: ArkOwnerHearts, captureId: string, next: number): ArkOwnerHearts {
    const animals: Record<string, ArkAnimalHearts> = {};
    for (const [id, entry] of Object.entries(hearts.animals)) animals[id] = entry.captureId === captureId ? {...entry, hearts: clampArkHearts(next)} : entry;
    return {...hearts, animals};
}

/** The present animals' hearts, for the scene's bars (the recovering are not on the map). */
export function arkHeartsForScene(hearts: ArkOwnerHearts | null): Record<string, number> | null {
    if (!hearts) return null;
    const out: Record<string, number> = {};
    for (const entry of Object.values(hearts.animals)) if (entry.status === "present") out[entry.id] = entry.hearts;
    return out;
}

/**
 * Of the newcomers between two reads, the ones that truly came aboard: an animal back from recovering keeps its old
 * `arrived_at` (it is not a new arrival, and gets no "came aboard" notice). Without the earlier read's time, all of them.
 */
export function arkTrueArrivals<T extends {arrived_at: string}>(fresh: readonly T[], beforeAsOf: string | null | undefined, slackMs = 60 * 60_000): T[] {
    const since = beforeAsOf ? Date.parse(beforeAsOf) : NaN;
    if (!Number.isFinite(since)) return [...fresh];
    return fresh.filter((animal) => {
        const at = Date.parse(animal.arrived_at);
        return !Number.isFinite(at) || at >= since - slackMs;
    });
}
