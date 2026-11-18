/**
 * Release to the Wild (AnimalDex docs/ark/release-p1-8.md; owner decision 389, the ecosystem audit's section 4), the
 * web's side. Pure.
 *
 * - An owner can move their own ZOO animal to live free, for Credits: 10 to 60 by the kind's rarity tier. The price,
 *   every rule and the spend are the server's (`release_quote_v1`, `release_to_wild_v1`): this page never sends a price,
 *   only the animal and a key that makes a retry safe.
 * - A released animal carries a wild skill (0 to 1): how it copes at first. Everyone sees it on its card
 *   (`voyage_releases_public_v1`: animal ids, days and a number, no person).
 * - All of it only while the server's `release_to_wild` switch is on: off, or on a server without the functions, the
 *   quote is "not available" and nothing here shows.
 *
 * Privacy: the owner's own quote and balance only; the public list names no person and no price.
 */

import {fillArkWords} from "@/lib/ark-words";

/** The owner-approved ladder (decision 389, audit section 4.3), for words only: the server decides what is charged. */
export const ARK_RELEASE_LADDER = [
    {tier: "Common", credits: 10},
    {tier: "Uncommon", credits: 15},
    {tier: "Rare", credits: 25},
    {tier: "Epic", credits: 35},
    {tier: "Legendary", credits: 50},
    {tier: "Mythic", credits: 60}
] as const;

/** Why an animal cannot be released now (`voyage_release_check`), plus what the spend can answer. */
export const ARK_RELEASE_REASONS = [
    "unavailable", "not_owner", "no_card", "under_13", "recovering", "not_in_zoo", "lives_with_people", "unpriced", "care_wait",
    "dormant", "carrying", "not_now", "pair_full", "kind_full", "predators_full", "cooldown_day", "cooldown_kind"
] as const;
export type ArkReleaseReason = (typeof ARK_RELEASE_REASONS)[number];
/** What a release call can come back with when it did not go through. */
export type ArkReleaseProblem = ArkReleaseReason | "insufficient_credits" | "not_authenticated" | "failed";

export type ArkReleaseQuote = {
    available: boolean;
    eligible: boolean;
    reasons: ArkReleaseReason[];
    animalId: string | null;
    name: string | null;
    tier: string | null;
    credits: number | null;
    /** The reader's own Credits. */
    balance: number | null;
    /** Where its kind lives free: the wild island, or the town's wildlife. */
    island: "wild" | "town" | null;
    zone: string | null;
    /** Its wild skill on the day (0.2 zoo-raised; 0.3 when its owner already holds its kind's Power). */
    wildSkill: number;
    hasPower: boolean;
    /** Its kind is in danger in the wild now: releasing it would end the crisis. */
    rescue: {band: "critical" | "last"; wildCount: number} | null;
    /** None of its kind lives in the wild now. */
    goneFromWild: boolean;
    /** When a wait is over (a cooldown, or the 30 days after a return into care), ISO. */
    nextAt: string | null;
};

export type ArkReleaseResult = {
    releaseId: string;
    animalId: string;
    creditsSpent: number;
    balance: number;
    island: "wild" | "town";
    wildSkill: number;
    rescue: boolean;
};

/** A released animal living free, as everyone sees it. */
export type ArkReleased = {animalId: string; releasedArkDay: number; wildSkill: number};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The server's own shape for the retry key (`voyage_release_one`). */
export const ARK_RELEASE_KEY = /^[A-Za-z0-9_-]{8,64}$/;

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const islandOf = (value: unknown): "wild" | "town" | null => (value === "wild" || value === "town" ? value : null);

export const ARK_RELEASE_UNAVAILABLE: ArkReleaseQuote = {
    available: false, eligible: false, reasons: ["unavailable"], animalId: null, name: null, tier: null, credits: null, balance: null,
    island: null, zone: null, wildSkill: 0.2, hasPower: false, rescue: null, goneFromWild: false, nextAt: null
};

/** `release_quote_v1`'s answer, checked; null when it is not one. An unknown reason is kept as "not now". */
export function decodeArkReleaseQuote(raw: unknown): ArkReleaseQuote | null {
    const row = record(raw);
    if (!row || typeof row.available !== "boolean") return null;
    if (!row.available) return ARK_RELEASE_UNAVAILABLE;
    const known = new Set<string>(ARK_RELEASE_REASONS);
    const reasons = (Array.isArray(row.reasons) ? row.reasons : []).filter((r): r is string => typeof r === "string").map((r) => (known.has(r) ? r : "not_now") as ArkReleaseReason);
    const to = record(row.to);
    const rescue = record(row.rescue);
    const credits = num(row.credits);
    const band = rescue?.band === "last" || rescue?.band === "critical" ? rescue.band : null;
    const nextAt = text(row.next_at, 40);
    const animalId = text(row.animal_id, 40);
    return {
        available: true,
        // Eligible only when the server says so AND it gave a price (nothing is ever offered without one).
        eligible: row.eligible === true && reasons.length === 0 && credits !== null && credits > 0,
        reasons: reasons.length || row.eligible === true ? reasons : ["not_now"],
        animalId: animalId && UUID.test(animalId) ? animalId.toLowerCase() : null,
        name: text(row.name, 120),
        tier: text(row.tier, 24),
        credits: credits !== null && credits > 0 ? Math.round(credits) : null,
        balance: num(row.balance) !== null ? Math.max(Math.round(num(row.balance)!), 0) : null,
        island: islandOf(to?.island),
        zone: text(to?.zone, 40),
        wildSkill: clamp01(num(row.wild_skill) ?? 0.2),
        hasPower: row.has_power === true,
        rescue: band ? {band, wildCount: Math.max(Math.round(num(rescue?.wild_count) ?? (band === "last" ? 1 : 2)), 0)} : null,
        goneFromWild: row.gone_from_wild === true,
        nextAt: nextAt && !Number.isNaN(Date.parse(nextAt)) ? nextAt : null
    };
}

/** `release_to_wild_v1`'s answer, checked. */
export function decodeArkReleaseResult(raw: unknown): ArkReleaseResult | null {
    const row = record(raw);
    const to = record(row?.to);
    const releaseId = text(row?.release_id, 40);
    const animalId = text(row?.animal_id, 40);
    const island = islandOf(to?.island);
    const spent = num(row?.credits_spent);
    const balance = num(row?.balance);
    if (!row || row.released !== true || !releaseId || !animalId || !UUID.test(animalId) || !island || spent === null || balance === null) return null;
    return {releaseId, animalId: animalId.toLowerCase(), creditsSpent: Math.round(spent), balance: Math.max(Math.round(balance), 0), island, wildSkill: clamp01(num(row.wild_skill) ?? 0.2), rescue: row.rescue === true};
}

/** The server's error message as a code the page has words for (`release_<reason>`, `insufficient_credits`). */
export function arkReleaseProblem(message: string | null | undefined): ArkReleaseProblem {
    const m = (message ?? "").toLowerCase();
    if (m.includes("insufficient_credits")) return "insufficient_credits";
    if (m.includes("not_authenticated")) return "not_authenticated";
    const hit = /release_([a-z0-9_]+)/.exec(m)?.[1];
    return hit && (ARK_RELEASE_REASONS as readonly string[]).includes(hit) ? hit as ArkReleaseReason : "failed";
}

/** `voyage_releases_public_v1`'s list by animal id; null while the server's switch is off or the read is absent. */
export function decodeArkReleased(raw: unknown): Record<string, ArkReleased> | null {
    const row = record(raw);
    if (!row || row.available !== true || !Array.isArray(row.released)) return null;
    const out: Record<string, ArkReleased> = {};
    for (const item of row.released) {
        const entry = record(item);
        const id = text(entry?.animal_id, 40);
        const day = num(entry?.released_ark_day);
        const skill = num(entry?.wild_skill);
        if (!id || !UUID.test(id) || day === null || skill === null) continue;
        out[id.toLowerCase()] = {animalId: id.toLowerCase(), releasedArkDay: day, wildSkill: clamp01(skill)};
    }
    return out;
}

/** `/api/ark/release`'s `released` (this module's own shape, by animal id), checked again on the page; null: off. */
export function arkReleasedFromApi(raw: unknown): Record<string, ArkReleased> | null {
    const row = record(raw);
    if (!row) return null;
    return decodeArkReleased({
        available: true,
        released: Object.values(row).map((item) => {
            const entry = record(item);
            return {animal_id: entry?.animalId, released_ark_day: entry?.releasedArkDay, wild_skill: entry?.wildSkill};
        })
    });
}

/** A key for one release attempt (kept for its retries): 22 characters of the server's alphabet. */
export function arkReleaseKey(random: (bytes: Uint8Array) => Uint8Array = (bytes) => globalThis.crypto.getRandomValues(bytes)): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    return Array.from(random(new Uint8Array(22)), (byte) => alphabet[byte % 64]).join("");
}

// MARK: Wild skill

/** The skill in plain words (audit section 4.4): still learning below the engine's "weak" line, then wary, then at home. */
export type ArkWildSkillBand = "learning" | "wary" | "home";
export function arkWildSkillBand(skill: number): ArkWildSkillBand {
    return skill >= 0.9 ? "home" : skill >= 0.6 ? "wary" : "learning";
}

// MARK: Words

/** The card's and the sheet's words (`ark.release` in the locale files). */
export type ArkReleaseWords = {
    button: string;
    title: string;
    toWild: string;
    toTown: string;
    skill: string;
    skillLearning: string;
    skillWary: string;
    skillHome: string;
    skillPower: string;
    warn: string;
    hearts: string;
    rules: string;
    price: string;
    balance: string;
    rescueLast: string;
    rescueCritical: string;
    gone: string;
    confirm: string;
    confirming: string;
    cancel: string;
    noCredits: string;
    getCredits: string;
    failed: string;
    done: string;
    doneRescue: string;
    step: string;
    stepHint: string;
    close: string;
    live: string;
    reason: Record<ArkReleaseReason, string>;
    until: string;
};

export const ARK_RELEASE_ENGLISH: ArkReleaseWords = {
    button: "Release to the wild · {credits} Credits",
    title: "Release {animal} to the wild?",
    toWild: "It will leave the zoo and live free in the {zone}.",
    toTown: "It will leave the zoo and live free in the town.",
    skill: "Wild skill",
    skillLearning: "Learning to find food",
    skillWary: "Wary",
    skillHome: "At home in the wild",
    skillPower: "You hold its Power: it starts a little ahead.",
    warn: "Zoo-raised animals struggle at first. Do its step to help it survive.",
    hearts: "It keeps its hearts. If it fails with a heart left, it comes back into the zoo and waits 30 days.",
    rules: "No refund once it is released. One release a day.",
    price: "{credits} Credits",
    balance: "You have {credits}",
    rescueLast: "Only 1 {animal} is left in the wild. Releasing yours could save the species.",
    rescueCritical: "Only {count} are left in the wild. Releasing yours could save the species.",
    gone: "None is left in the wild. Yours would bring the species back.",
    confirm: "Release · {credits} Credits",
    confirming: "Releasing…",
    cancel: "Not now",
    noCredits: "You need {credits} Credits to release it.",
    getCredits: "Get Credits",
    failed: "That didn't go through, and nothing was charged. Try again in a moment.",
    done: "{animal} is out of the zoo and living free.",
    doneRescue: "{animal} is out of the zoo and living free. Its species is out of danger for now.",
    step: "Do its step",
    stepHint: "A step that works raises its wild skill.",
    close: "Close",
    live: "{aAnimal} was released into the wild",
    reason: {
        unavailable: "Releases are not open right now.",
        not_owner: "Only the person who brought it can release it.",
        no_card: "Only the person who holds its card can release it.",
        under_13: "Releases are not open on this account.",
        recovering: "It is away recovering.",
        not_in_zoo: "It already lives free.",
        lives_with_people: "Its kind lives with people, so it stays.",
        unpriced: "It cannot be released yet.",
        care_wait: "It came back into care. It can go again {when}.",
        dormant: "It is asleep for the season. Try when it wakes.",
        carrying: "It is expecting young. Try after they are born.",
        not_now: "It cannot be moved right now. Try again in an hour.",
        pair_full: "Two of yours already live free. That is the pair.",
        kind_full: "The wild has all of its kind it can hold right now.",
        predators_full: "There are too many hunters of its prey there right now.",
        cooldown_day: "One release a day. You can release again {when}.",
        cooldown_kind: "One of a kind a week. You can release this kind again {when}."
    },
    until: "on {date}"
};

/** The reader's `ark.release` over English, key by key. */
export function arkReleaseWords(raw: unknown): ArkReleaseWords {
    const own = record(raw) ?? {};
    const reasonOwn = record(own.reason) ?? {};
    const out: ArkReleaseWords = {...ARK_RELEASE_ENGLISH, reason: {...ARK_RELEASE_ENGLISH.reason}};
    for (const key of Object.keys(ARK_RELEASE_ENGLISH) as Array<keyof ArkReleaseWords>) {
        if (key === "reason") continue;
        const value = own[key];
        if (typeof value === "string" && value.trim()) (out[key] as string) = value;
    }
    for (const key of ARK_RELEASE_REASONS) {
        const value = reasonOwn[key];
        if (typeof value === "string" && value.trim()) out.reason[key] = value;
    }
    return out;
}

export function arkWildSkillText(skill: number, words: ArkReleaseWords): string {
    const band = arkWildSkillBand(skill);
    return band === "home" ? words.skillHome : band === "wary" ? words.skillWary : words.skillLearning;
}

/** Why it cannot go now, in the reader's words; a wait says until when. */
export function arkReleaseReasonText(reason: ArkReleaseReason, quote: Pick<ArkReleaseQuote, "nextAt">, words: ArkReleaseWords, locale: string): string {
    let when = "";
    if (quote.nextAt) {
        try {
            when = fillArkWords(words.until, {date: new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "numeric", minute: "2-digit"}).format(new Date(quote.nextAt))});
        } catch {
            when = "";
        }
    }
    return fillArkWords(words.reason[reason] ?? words.reason.not_now, {when}).replace(/\s+([.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/** The rescue banner's line, or null. */
export function arkReleaseRescueText(quote: Pick<ArkReleaseQuote, "rescue" | "goneFromWild" | "name" | "island">, words: ArkReleaseWords, locale: string): string | null {
    if (quote.island !== "wild") return null;
    if (quote.rescue?.band === "last") return fillArkWords(words.rescueLast, {animal: quote.name ?? ""});
    if (quote.rescue) return fillArkWords(words.rescueCritical, {count: quote.rescue.wildCount.toLocaleString(locale)});
    return quote.goneFromWild ? words.gone : null;
}
