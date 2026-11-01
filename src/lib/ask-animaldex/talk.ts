/**
 * Talk on the web (docs/rich-chat/SPEC.md, section 4): the full-screen chat
 * at /talk, the pure half. Its words (English here, the locale's `talk` over
 * them), the sidebar's Recent chats read from this browser's thread store,
 * the animal picker's search, what each capability offers whoever is
 * reading, and the page's title. Pure, so it is tested.
 */

import type {AskMessage, AskThreads} from "@/lib/ask-animaldex/thread";
import {askInlinePlainText} from "@/lib/ask-animaldex/markdown";

export const TALK_WORDS_EN = {
    metaTitle: "Talk to an animal",
    metaDescription: "Talk to any animal in AnimalDex, free. Each one answers from its own Power, a lesson from how its kind survives, so you hear a real side, not agreement.",
    /** "Talk to a Gray Wolf — AnimalDex", for shares; "an" before a vowel sound. */
    animalTitleA: "Talk to a {animal}",
    animalTitleAn: "Talk to an {animal}",
    animalDescription: "Talk to the {animal}. It answers from its own Power, {power}: a side, not agreement.",
    animalDescriptionNoPower: "Talk to the {animal}. It answers from its own life: a side, not agreement.",
    newChat: "New chat",
    yourAnimals: "Your animals",
    recentChats: "Recent chats",
    today: "Today",
    yesterday: "Yesterday",
    earlier: "Earlier",
    deleteChat: "Delete this chat",
    keptHere: "Chats are kept in this browser.",
    /** Signed in, with history kept on the account (docs/chat-sync/SPEC.md, section 3). */
    syncedHere: "Synced to your account",
    /** The sidebar with no chats yet (WEB-36). */
    noChatsYet: "Your chats with animals appear here.",
    startWith: "Start with",
    signUpFree: "Sign up free",
    signIn: "Sign in",
    account: "Your account",
    getApp: "Get the app",
    openChats: "Chats",
    closeChats: "Close",
    home: "AnimalDex home",
    pickerTitle: "Who do you want to talk to?",
    pickerHint: "Every animal answers from its own Power, so each one sees your problem its own way.",
    searchPlaceholder: "Search every animal",
    searchLabel: "Search animals by name",
    searchEmpty: "No animal by that name yet.",
    popular: "Popular to talk to",
    disagree: "They'll disagree",
    disagreeHint: "Ask both the same thing.",
    /** "They'll disagree": what each pair pulls apart on (WEB-5). */
    disagreeWaitOrGo: "Wait, or go now?",
    disagreePushOrOutlast: "Push through, or outlast it?",
    disagreeTogetherOrAlone: "Together, or alone?",
    carried: "Your question",
    /** "Ask another animal" carries the question; it is never sent for them (DECISIONS section 6). */
    carriedHint: "Pick an animal. Your question will be ready to send.",
    carriedClear: "Clear",
    loading: "Loading…",
    loadFailed: "Couldn't load the animals.",
    tryAgain: "Try again",
    capabilities: "What {name} can do",
    capTalk: "Talk",
    capTalkNote: "Available now",
    capTrials: "{animal}'s Trials",
    capTrialsNote: "Its own challenges",
    capStep: "Your step",
    capStepNote: "{animal} gives you one step to try, from your own problem. Capture one in the app to start.",
    capDebates: "Debates",
    capDebatesNote: "Bring other animals in to argue it out, once you've earned an animal's Power in the app.",
    /** The two things only the app's own animals do, as one quiet chip under the contact card (visual first: no caption, no two locks). */
    capInApp: "Steps and debates",
    capInAppNote: "{animal} can set you a step from your own problem, and bring other animals in to argue it out. Capture one in the app to start.",
    locked: "Locked",
    createAccount: "Create a free account",
    doTrial: "Do this Trial",
    catchForTrials: "Capture a {animal} in the app to work on its Trials",
    noTrials: "No Trials for this animal yet.",
    askAnother: "Ask another animal",
    /** Under the first real answer: steps and debates need a captured animal, so the app (W13). */
    signUpForMore: "Get the app to set steps and start debates",
    /** A share card's alt text. */
    ogAlt: "Talk to animals on AnimalDex"
};

export type TalkWords = typeof TALK_WORDS_EN;

/** What "What {name} can do" says: all the drawer needs of the Talk page's words (WEB-38). */
export const TALK_CAPABILITY_KEYS = [
    "capabilities", "capTalk", "capTalkNote", "capTrials", "capStep", "capStepNote", "capDebates", "capDebatesNote", "capInApp", "capInAppNote",
    "locked", "getApp", "catchForTrials", "noTrials"
] as const;

export type TalkCapabilityWords = Pick<TalkWords, (typeof TALK_CAPABILITY_KEYS)[number]>;

export function talkCapabilityWords(words: TalkWords): TalkCapabilityWords {
    return Object.fromEntries(TALK_CAPABILITY_KEYS.map((key) => [key, words[key]])) as TalkCapabilityWords;
}

/** The locale's `talk` words over the English ones. */
export function talkWords(raw: unknown): TalkWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(TALK_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as TalkWords;
}

/** "Talk to a Gray Wolf", "Talk to an Owl": the article by the name's first sound, as English writes it. */
export function talkAnimalTitle(animal: string, words: TalkWords): string {
    const name = animal.trim();
    const template = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name) ? words.animalTitleAn : words.animalTitleA;
    return template.replace("{animal}", name);
}

// MARK: - Recent chats

/** What a thread is about, kept beside the thread store so the sidebar can name and open it. */
export type TalkThreadMeta = {
    slug: string;
    name: string;
    /** The owner's own card: its chat opens with the companion loop. */
    captureId: string | null;
    nickname: string | null;
};

export type TalkThreadMetas = Record<string, TalkThreadMeta>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** One stored entry, or nothing: a malformed one is dropped, never the list. */
export function normalizeTalkThreadMeta(raw: unknown): TalkThreadMeta | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const slug = typeof row.slug === "string" && SLUG.test(row.slug) ? row.slug : null;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 120) : "";
    if (!slug || !name) return null;
    const captureId = typeof row.captureId === "string" && /^[0-9a-f-]{36}$/i.test(row.captureId) ? row.captureId.toLowerCase() : null;
    const nickname = typeof row.nickname === "string" && row.nickname.trim() ? row.nickname.trim().slice(0, 60) : null;
    return {slug, name, captureId, nickname};
}

export function normalizeTalkThreadMetas(raw: unknown): TalkThreadMetas {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const metas: TalkThreadMetas = {};
    for (const [key, value] of Object.entries(row)) {
        const meta = normalizeTalkThreadMeta(value);
        if (meta && /^(species|capture):/.test(key)) metas[key] = meta;
    }
    return metas;
}

/** "gray-wolf" → "Gray Wolf", for a thread saved before its name was. */
export function talkNameFromSlug(slug: string): string {
    return slug.split("-").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

export type TalkRecentChat = {
    key: string;
    slug: string;
    name: string;
    /** The owner's own card's chat. */
    captureId: string | null;
    /** The last message's first line, as plain text. */
    preview: string;
    lastAt: number;
};

export type TalkRecentGroup = {group: "today" | "yesterday" | "earlier"; chats: TalkRecentChat[]};

/** The first line of a message with words in it, plain: markdown marks and drawings gone. */
function previewOf(messages: AskMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const text = messages[index].text;
        if (!text.trim()) continue;
        let inFence = false;
        for (const raw of text.split("\n")) {
            const line = raw.trim();
            if (line.startsWith("```")) {
                inFence = !inFence;
                continue;
            }
            if (inFence || !line || /^\|/.test(line)) continue;
            const plain = askInlinePlainText(line.replace(/^#{1,6}\s+/, "").replace(/^([-*+]|\d{1,2}[.)])\s+/, "")).trim();
            if (plain) return plain.length > 90 ? `${plain.slice(0, 89).trimEnd()}…` : plain;
        }
    }
    return "";
}

function startOfDay(at: number): number {
    const day = new Date(at);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
}

/**
 * Every animal thread in this browser with at least one message, newest
 * first, grouped Today / Yesterday / Earlier. A species thread with no saved
 * name is named from its slug; a card's thread only once its name was kept
 * (it cannot be opened without its species). The site-wide assistant's and
 * a Trial's threads are not animals' chats.
 */
/**
 * What of the thread store the Recent chats list depends on, as one string:
 * each thread's key, its length and its last message's id, status and time.
 * A reply typing out changes the store many times a second; none of that
 * changes this, so the sidebar can keep its rows until a message lands.
 */
export function talkThreadsDigest(threads: AskThreads): string {
    const parts: string[] = [];
    for (const [key, messages] of Object.entries(threads)) {
        if (!messages || messages.length === 0) continue;
        const last = messages[messages.length - 1];
        parts.push(`${key}\u0001${messages.length}\u0001${last.id}\u0001${last.status}\u0001${last.createdAt}`);
    }
    return parts.join("\u0002");
}

export function talkRecentChats(threads: AskThreads, metas: TalkThreadMetas, now: number = Date.now()): TalkRecentGroup[] {
    const chats: TalkRecentChat[] = [];
    for (const [key, messages] of Object.entries(threads)) {
        if (!messages || messages.length === 0) continue;
        const meta = metas[key] ?? null;
        let slug: string | null = null;
        let name: string | null = null;
        let captureId: string | null = null;
        if (key.startsWith("species:")) {
            slug = key.slice("species:".length);
            if (!SLUG.test(slug)) continue;
            name = meta?.name ?? talkNameFromSlug(slug);
        } else if (key.startsWith("capture:") && meta) {
            slug = meta.slug;
            name = meta.nickname ?? meta.name;
            captureId = key.slice("capture:".length);
        } else {
            continue;
        }
        const lastAt = Date.parse(messages[messages.length - 1].createdAt) || 0;
        chats.push({key, slug, name, captureId, preview: previewOf(messages), lastAt});
    }
    chats.sort((left, right) => right.lastAt - left.lastAt);
    const today = startOfDay(now);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const groups: TalkRecentGroup[] = [];
    for (const chat of chats) {
        const group = chat.lastAt >= today ? "today" : chat.lastAt >= yesterday ? "yesterday" : "earlier";
        const last = groups[groups.length - 1];
        if (last?.group === group) last.chats.push(chat);
        else groups.push({group, chats: [chat]});
    }
    return groups;
}

/** A thread kept on the reader's account (`/api/ask/history?list=1`), as the sidebar lists it. */
export type TalkServerChat = {key: string; serverKey: string; slug: string; name: string; captureId: string | null; preview: string; lastAt: number};

/**
 * Recent chats with the account's threads (docs/chat-sync/SPEC.md, section 3):
 * this browser's and the account's, one row per thread (the browser's key),
 * the newer of the two times and the browser's preview while it has one;
 * each row keeps the account's key, for Delete. Grouped as `talkRecentChats`.
 */
export function talkMergeRecentChats(
    local: TalkRecentGroup[],
    server: readonly TalkServerChat[],
    now: number = Date.now()
): Array<TalkRecentGroup & {chats: Array<TalkRecentChat & {serverKey?: string}>}> {
    const byKey = new Map<string, TalkRecentChat & {serverKey?: string}>();
    for (const group of local) for (const chat of group.chats) byKey.set(chat.key, {...chat});
    for (const remote of server) {
        const known = byKey.get(remote.key);
        if (known) {
            byKey.set(remote.key, {...known, serverKey: remote.serverKey, lastAt: Math.max(known.lastAt, remote.lastAt), preview: known.preview || remote.preview});
        } else {
            byKey.set(remote.key, {key: remote.key, slug: remote.slug, name: remote.name, captureId: remote.captureId, preview: remote.preview, lastAt: remote.lastAt, serverKey: remote.serverKey});
        }
    }
    const chats = Array.from(byKey.values()).sort((left, right) => right.lastAt - left.lastAt);
    const today = startOfDay(now);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const groups: Array<TalkRecentGroup & {chats: Array<TalkRecentChat & {serverKey?: string}>}> = [];
    for (const chat of chats) {
        const group = chat.lastAt >= today ? "today" : chat.lastAt >= yesterday ? "yesterday" : "earlier";
        const last = groups[groups.length - 1];
        if (last?.group === group) last.chats.push(chat);
        else groups.push({group, chats: [chat]});
    }
    return groups;
}

/** "14:02" today, "Yesterday" and then "12 Oct": when the chat last moved, at a glance. */
export function talkRelativeTime(at: number, options: {locale: string; yesterday: string; now?: number}): string {
    const now = options.now ?? Date.now();
    const today = startOfDay(now);
    try {
        if (at >= today) return new Intl.DateTimeFormat(options.locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(at);
        if (at >= today - 24 * 60 * 60 * 1000) return options.yesterday;
        const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
        return new Intl.DateTimeFormat(options.locale, {day: "numeric", month: "short", ...(sameYear ? {} : {year: "numeric"})}).format(at);
    } catch {
        return "";
    }
}

/** The thread's link on the Talk page: the animal's chat, or the owner's card's chat. */
export function talkChatPath(chat: {slug: string; captureId: string | null}): string {
    return chat.captureId ? `/talk/${chat.slug}?card=${encodeURIComponent(chat.captureId)}` : `/talk/${chat.slug}`;
}

// MARK: - The picker

export type TalkAnimal = {
    slug: string;
    name: string;
    power: string | null;
    /** Its icon art's own address, when the server knows it: no redirect to follow (WEB-18). */
    icon?: string | null;
    /** The file its icon art is in the bucket (the search index carries this, a few bytes, instead of a full address). */
    iconFile?: string | null;
};

function folded(text: string): string {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * How well a name answers the query (WEB-4), best first: the name itself;
 * then its last word, the head noun a person types ("wolf" for the Gray Wolf,
 * "fox" for the Red Fox); then a name starting with it; then a word starting
 * with it; then anywhere in it. -1 when it does not match at all.
 */
export function talkSearchRank(rawName: string, rawQuery: string): number {
    const name = folded(rawName).trim();
    const wanted = folded(rawQuery).trim().replace(/\s+/g, " ");
    if (!wanted || !name) return -1;
    if (name === wanted) return 0;
    const words = name.split(/[\s-]+/).filter(Boolean);
    const tail = words.slice(-wanted.split(" ").length).join(" ");
    if (tail === wanted) return 1;
    if (name.startsWith(wanted)) return 2;
    if (words.some((word) => word.startsWith(wanted))) return 3;
    return name.includes(wanted) ? 4 : -1;
}

/**
 * The catalog by common name, ranked by `talkSearchRank`; within a rank, the
 * better-known animal first (the order `animals` comes in: most captured
 * first, as the catalog route sends it), then the shorter name. So "wolf"
 * finds the Gray Wolf before the Wolf Eel, and "fox" the Red Fox before the
 * Fox Moth.
 */
export function talkSearch(animals: readonly TalkAnimal[], query: string, limit = 24): TalkAnimal[] {
    if (!folded(query.trim())) return [];
    const ranked: Array<{animal: TalkAnimal; rank: number; order: number}> = [];
    animals.forEach((animal, order) => {
        const rank = talkSearchRank(animal.name, query);
        if (rank >= 0) ranked.push({animal, rank, order});
    });
    ranked.sort((left, right) => left.rank - right.rank
        || left.order - right.order
        || left.animal.name.length - right.animal.name.length
        || left.animal.name.localeCompare(right.animal.name));
    return ranked.slice(0, limit).map((entry) => entry.animal);
}

// MARK: - The first animals offered

/**
 * The first animals offered to someone new, in this order, on the web picker
 * and in the apps' "Or meet one now" (UX pass, DECISIONS section 7). Each is
 * kept only with its own species icon art and a Power that reads as a lesson.
 */
export const TALK_FEATURED_SLUGS = [
    "gray-wolf",
    "common-octopus",
    "little-owl",
    "orca",
    "african-bush-elephant",
    "western-honey-bee"
] as const;

/** After the featured six, while too few people have talked to enough animals: well-loved ones whose Powers differ. */
export const TALK_FEATURED_FILL_SLUGS = [
    "cheetah",
    "honey-badger",
    "gal-pagos-tortoise",
    "emperor-penguin",
    "sea-otter",
    "common-raven"
] as const;

/**
 * "They'll disagree" (WEB-5): pairs whose Powers pull apart on one question,
 * each with that question. Little Owl waits for the moment, the Cheetah goes
 * all at once; the Honey Badger pushes through, the tortoise outlasts; the
 * wolf works as a pack, the snow leopard alone.
 */
export const TALK_DISAGREE_PAIRS = [
    {left: "little-owl", right: "cheetah", topic: "disagreeWaitOrGo"},
    {left: "honey-badger", right: "gal-pagos-tortoise", topic: "disagreePushOrOutlast"},
    {left: "gray-wolf", right: "snow-leopard", topic: "disagreeTogetherOrAlone"}
] as const satisfies ReadonlyArray<{left: string; right: string; topic: keyof TalkWords}>;

export type TalkDisagreePair = {left: TalkAnimal; right: TalkAnimal; topic: string | null};

/**
 * A Power that reads as a lesson, for the curated lists: a phrase ("Night
 * Focus Strategy", "Memory Path") or a noun of a way of living
 * ("Cooperation", "Longevity"), never a bare adjective stub ("Urban",
 * "Uninvited") or nothing.
 */
export function talkPowerReadsAsLesson(power: string | null | undefined): boolean {
    const text = power?.trim() ?? "";
    if (!text) return false;
    if (text.split(/\s+/).length >= 2) return true;
    // One word: a noun of a way of living, not an adjective standing alone.
    return !/(ed|an|al|ous|ive|ful|less|ic|ish|ent|ant|ary|ile|able|ible)$/i.test(text);
}

/**
 * The picker's first rows: the featured animals, then the most talked to,
 * then the curated fill, each once, only with its own art (`hasArt`) and a
 * Power that reads as a lesson, at most `max`.
 */
export function talkFeaturedAnimals(params: {
    bySlug: ReadonlyMap<string, TalkAnimal>;
    talkedTo: readonly string[];
    hasArt: (slug: string) => boolean;
    max?: number;
}): TalkAnimal[] {
    const max = params.max ?? 12;
    const picked: TalkAnimal[] = [];
    const seen = new Set<string>();
    for (const slug of [...TALK_FEATURED_SLUGS, ...params.talkedTo, ...TALK_FEATURED_FILL_SLUGS]) {
        if (picked.length >= max) break;
        if (seen.has(slug) || slug === "human") continue;
        seen.add(slug);
        const animal = params.bySlug.get(slug);
        if (!animal || !params.hasArt(slug) || !talkPowerReadsAsLesson(animal.power)) continue;
        picked.push(animal);
    }
    return picked;
}

/**
 * "Ask another animal" under a public chat's reply (SPEC section 4.4; WEB-3):
 * only under a finished answer to a real problem, and never once today's
 * messages are spent (it would only lead to the limit card).
 */
export function talkAskAnotherOffered(params: {publicChat: boolean; quotaReached: boolean; finished: boolean; realProblem: boolean}): boolean {
    return params.publicChat && !params.quotaReached && params.finished && params.realProblem;
}

// MARK: - Capabilities

export type TalkViewer = {signedIn: boolean};

/**
 * What a locked capability offers (section 4.4; UX pass JRN-6, WEB-19): Your
 * step, Debates and a Trial all need an animal of their own, captured in the
 * app, so each offers the app, signed in or not. An account alone unlocks
 * none of them: sign-up is offered only for the message budget.
 */
export function talkCapabilityAction(kind: "step" | "debates" | "trial", _viewer: TalkViewer): "app" | "catch" {
    return kind === "trial" ? "catch" : "app";
}

/** The account page (sign in or sign up, one page) that comes back to this chat. */
export function talkSignUpHref(path: string): string {
    return `/account?next=${encodeURIComponent(path || "/talk")}`;
}

/** A catalog row as the Talk page reads it (`species_catalog_v1`). */
export type TalkCatalogRow = {
    landing_page_slug?: unknown;
    display_name?: unknown;
    principle_name?: unknown;
    public_capture_count?: unknown;
    /** The catalog's authored contrasts: animals whose way runs the other way. */
    contrasting_species?: unknown;
    /** How a species page finds its catalog animal (WEB-1). */
    species_profile_id?: unknown;
    normalized_identity_key?: unknown;
};

/**
 * "They'll disagree" (SPEC section 4.3): pairs the catalog itself says pull
 * opposite ways (an animal's `contrasting_species`, matched to another
 * animal by name), the best known first (by the lesser of the two's public
 * captures), each animal in one pair at most.
 */
export function talkDisagreePairs(rows: readonly TalkCatalogRow[], max = 6): Array<[string, string]> {
    const byName = new Map<string, {slug: string; caught: number}>();
    for (const row of rows) {
        if (typeof row.landing_page_slug !== "string" || typeof row.display_name !== "string") continue;
        const key = row.display_name.trim().toLowerCase();
        if (key && !byName.has(key)) byName.set(key, {slug: row.landing_page_slug, caught: Number(row.public_capture_count) || 0});
    }
    const candidates: Array<{pair: [string, string]; score: number}> = [];
    const seen = new Set<string>();
    for (const row of rows) {
        if (typeof row.landing_page_slug !== "string" || typeof row.display_name !== "string" || !Array.isArray(row.contrasting_species)) continue;
        const self = byName.get(row.display_name.trim().toLowerCase());
        if (!self || self.slug !== row.landing_page_slug) continue;
        for (const contrast of row.contrasting_species as unknown[]) {
            const name = contrast && typeof contrast === "object" ? (contrast as {display_name?: unknown}).display_name : null;
            const other = typeof name === "string" ? byName.get(name.trim().toLowerCase()) : undefined;
            if (!other || other.slug === self.slug) continue;
            const key = [self.slug, other.slug].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push({pair: [self.slug, other.slug], score: Math.min(self.caught, other.caught)});
        }
    }
    candidates.sort((left, right) => right.score - left.score || left.pair.join().localeCompare(right.pair.join()));
    const used = new Set<string>();
    const pairs: Array<[string, string]> = [];
    for (const {pair} of candidates) {
        if (pairs.length >= max) break;
        if (used.has(pair[0]) || used.has(pair[1])) continue;
        used.add(pair[0]);
        used.add(pair[1]);
        pairs.push(pair);
    }
    return pairs;
}
