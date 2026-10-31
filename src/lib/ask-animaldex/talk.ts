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
    mostCaught: "Most caught on AnimalDex",
    disagree: "They'll disagree",
    disagreeHint: "Ask both the same thing.",
    carried: "Your question",
    carriedClear: "Clear",
    loading: "Loading…",
    capabilities: "What {name} can do",
    capTalk: "Talk",
    capTalkNote: "Available now",
    capTrials: "Its Trials",
    capTrialsNote: "Its own challenges",
    capStep: "Your step",
    capStepNote: "{animal} gives you one step to try, from your own problem. Catch one to start.",
    capDebates: "Debates",
    capDebatesNote: "Bring other animals in to argue it out. Once you've earned an animal's Power.",
    locked: "Locked",
    createAccount: "Create a free account",
    doTrial: "Do this Trial",
    catchForTrials: "Catch a {animal} in the app to work on its Trials",
    noTrials: "No Trials for this animal yet.",
    askAnother: "Ask another animal",
    signUpForMore: "Sign up to set steps and start debates"
};

export type TalkWords = typeof TALK_WORDS_EN;

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

export type TalkAnimal = {slug: string; name: string; power: string | null};

function folded(text: string): string {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The catalog by common name: a name starting with the query first, then a
 * word in it starting with it, then anywhere in it; shorter names first
 * within each, so "owl" finds the Owl before the Burrowing Owl.
 */
export function talkSearch(animals: readonly TalkAnimal[], query: string, limit = 24): TalkAnimal[] {
    const wanted = folded(query.trim());
    if (!wanted) return [];
    const ranked: Array<{animal: TalkAnimal; rank: number}> = [];
    for (const animal of animals) {
        const name = folded(animal.name);
        const rank = name.startsWith(wanted) ? 0 : name.split(/[\s-]+/).some((word) => word.startsWith(wanted)) ? 1 : name.includes(wanted) ? 2 : -1;
        if (rank >= 0) ranked.push({animal, rank});
    }
    ranked.sort((left, right) => left.rank - right.rank || left.animal.name.length - right.animal.name.length || left.animal.name.localeCompare(right.animal.name));
    return ranked.slice(0, limit).map((entry) => entry.animal);
}

// MARK: - Capabilities

export type TalkViewer = {signedIn: boolean};

/**
 * What a locked capability offers (section 4.4): sign-up only where the
 * action needs an account. Your step and Debates: a visitor without an
 * account gets "Create a free account", a signed-in one "Get the app" (they
 * need a card, made in the app). A Trial's "Do this Trial": the account, or
 * signed in without the card, catching one in the app.
 */
export function talkCapabilityAction(kind: "step" | "debates" | "trial", viewer: TalkViewer): "signUp" | "app" | "catch" {
    if (!viewer.signedIn) return "signUp";
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
