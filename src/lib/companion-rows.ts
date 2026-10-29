/**
 * What each row of the Companions tab says (docs/companion-loop/SPEC.md,
 * phase 4; iOS `CompanionRows`, b933e6bd). Animal messages live here, not in
 * Messages: the animals that wrote to you, their newest unread line, the
 * unread dot and whether you muted them come from `animal_conversations`.
 *
 * With the bond loaded, the rows are in the server's order (an unread
 * message first, then a referral, then an open step, then recent activity).
 * An animal you hold that the bond list does not have (not loaded, the server
 * has no bond yet, or caught since it loaded) follows, one row per species,
 * unread first, then the most recent activity, with no bond parts. Pure.
 */

import {askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {companionDisplayName} from "@/lib/ask-animaldex/companion-loop";
import type {CompanionCard} from "@/lib/companion-cards";
import {
    COMPANION_WORDS_EN,
    bondChipText,
    companionStatusLine,
    companionSummaryName,
    type CompanionSummary,
    type CompanionWords
} from "@/lib/companion-bond";

/** One animal you talk with, or one that wrote to you (`animal_conversations`). */
export type AnimalConversation = {
    /** The canonical species. */
    speciesProfileId: string;
    /** Your newest card of it; null once you hold none, and then there is no chat to open. */
    captureId: string | null;
    animalName: string;
    nickname: string | null;
    /** The animal's own latest message (not the latest thing said in the chat). */
    lastMessageBody: string | null;
    lastMessageAt: string | null;
    /** The last day you chatted with it. */
    lastTalkedAt: string | null;
    unreadCount: number;
    muted: boolean;
};

/** Which of the status line's cases a row shows, for its colour. */
export type CompanionStatusKind = "unread" | "referral" | "step" | "focus" | "hello";

export type CompanionTabRow = {
    speciesProfileId: string;
    /** The card the server names for it (its newest); the chat may open on another. */
    captureId: string | null;
    animal: string;
    /** "Luna the Gray Wolf". */
    displayName: string;
    /** The species' icon-art slug: the animal is drawn as its art, never a photo. */
    slug: string | null;
    /** "Level 4 · Working together"; null until the bond has it. */
    bondText: string | null;
    mastered: boolean;
    status: {text: string; kind: CompanionStatusKind};
    /** Drives the dot, even when there is no line to preview. */
    unreadCount: number;
    muted: boolean;
    /** The referral another animal sent you here with, while the row says so. */
    referralWaiting: boolean;
    referralId: string | null;
    /** There is a conversation to mute. */
    hasConversation: boolean;
};

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function time(raw: string | null | undefined): number {
    const at = raw ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY;
}

/** Rows of `animal_conversations`, one per species. */
export function decodeAnimalConversations(raw: unknown): AnimalConversation[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw.flatMap((item): AnimalConversation[] => {
        const row = object(item);
        const speciesProfileId = str(row?.species_profile_id)?.toLowerCase();
        if (!row || !speciesProfileId || seen.has(speciesProfileId)) return [];
        seen.add(speciesProfileId);
        const unread = typeof row.unread_count === "number" ? row.unread_count : Number(row.unread_count);
        return [{
            speciesProfileId,
            captureId: str(row.capture_id)?.toLowerCase() ?? null,
            animalName: str(row.animal_name) ?? "",
            nickname: str(row.nickname),
            lastMessageBody: str(row.last_message_body),
            lastMessageAt: str(row.last_message_at),
            lastTalkedAt: str(row.last_talked_at),
            unreadCount: Number.isFinite(unread) ? Math.max(0, Math.round(unread)) : 0,
            muted: row.muted === true
        }];
    });
}

/**
 * A reply as one plain line: no step cards, no markdown marks (iOS
 * `AnimalMessageDelivery.previewText`). Paragraphs join as sentences, without
 * a second full stop after one that already ends.
 */
export function animalMessagePreviewText(raw: string): string {
    const withoutCards = raw.replace(/```[\s\S]*?(```|$)/g, " ");
    return askMarkdownPlainText(withoutCards)
        .replace(/([.!?…])\.(?=\s|$)/g, "$1")
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
}

/** The animal's latest message, which is the unread one while any are. */
function unreadPreview(conversation: AnimalConversation | undefined): string | null {
    if (!conversation || conversation.unreadCount <= 0 || !conversation.lastMessageBody) return null;
    return animalMessagePreviewText(conversation.lastMessageBody) || null;
}

function statusKind(
    row: {unread: number; referralWaiting: boolean; openTrial: string | null; focus: string | null},
    preview: string | null
): CompanionStatusKind {
    if (row.unread > 0 && preview) return "unread";
    if (row.referralWaiting) return "referral";
    if (row.openTrial) return "step";
    if (row.focus) return "focus";
    return "hello";
}

type Seed = {speciesProfileId: string; captureId: string; animal: string; nickname: string | null; slug: string | null; capturedAt: string | null};

export function buildCompanionRows({
    companions,
    conversations,
    cards,
    words = COMPANION_WORDS_EN
}: {
    companions: CompanionSummary[];
    conversations: AnimalConversation[];
    cards: CompanionCard[];
    words?: CompanionWords;
}): CompanionTabRow[] {
    const conversationOf = new Map(conversations.map((conversation) => [conversation.speciesProfileId, conversation]));
    const slugOf = new Map<string, string>();
    for (const card of cards) {
        if (card.slug && !slugOf.has(card.speciesProfileId)) slugOf.set(card.speciesProfileId, card.slug);
    }
    const seen = new Set<string>();

    const bonded = companions.flatMap((companion): CompanionTabRow[] => {
        const species = companion.speciesProfileId.toLowerCase();
        if (seen.has(species)) return [];
        seen.add(species);
        const conversation = conversationOf.get(species);
        // The browser's own count wins: it drops the moment the chat is read,
        // before the bond list is fetched again.
        const unread = conversation?.unreadCount ?? companion.unread;
        const preview = unreadPreview(conversation);
        const line = {unread, referralWaiting: companion.referralWaiting, openTrial: companion.openTrial, focus: companion.focus};
        const animal = companion.animal || conversation?.animalName || "";
        return [{
            speciesProfileId: species,
            captureId: companion.captureId ?? conversation?.captureId ?? null,
            animal,
            displayName: companion.animal
                ? companionSummaryName(companion, words)
                : companionDisplayName(conversation?.nickname, animal, words.displayName),
            slug: companion.slug ?? slugOf.get(species) ?? null,
            bondText: bondChipText(companion, words),
            mastered: companion.mastered,
            status: {text: companionStatusLine(line, preview, words).text, kind: statusKind(line, preview)},
            unreadCount: unread,
            muted: conversation?.muted ?? false,
            referralWaiting: companion.referralWaiting,
            referralId: companion.referralId,
            hasConversation: Boolean(conversation)
        }];
    });

    // A conversation through a card you still hold counts as holding the
    // animal, even before the cards have loaded.
    const seeds: Seed[] = [
        ...cards.map((card) => ({...card})),
        ...conversations.flatMap((conversation): Seed[] => conversation.captureId ? [{
            speciesProfileId: conversation.speciesProfileId,
            captureId: conversation.captureId,
            animal: conversation.animalName,
            nickname: conversation.nickname,
            slug: null,
            capturedAt: null
        }] : [])
    ].filter((seed) => !seen.has(seed.speciesProfileId));

    // The newest card of each species.
    const newest = new Map<string, Seed>();
    for (const seed of seeds) {
        const held = newest.get(seed.speciesProfileId);
        if (held && time(held.capturedAt) >= time(seed.capturedAt)) continue;
        newest.set(seed.speciesProfileId, seed);
    }

    const unbonded = Array.from(newest.values()).map((seed) => {
        const conversation = conversationOf.get(seed.speciesProfileId);
        const unread = conversation?.unreadCount ?? 0;
        const preview = unreadPreview(conversation);
        const line = {unread, referralWaiting: false, openTrial: null, focus: null};
        const activity = Math.max(time(conversation?.lastMessageAt), time(conversation?.lastTalkedAt), time(seed.capturedAt));
        const row: CompanionTabRow = {
            speciesProfileId: seed.speciesProfileId,
            captureId: seed.captureId,
            animal: seed.animal,
            displayName: companionDisplayName(conversation?.nickname ?? seed.nickname, seed.animal, words.displayName),
            slug: seed.slug ?? slugOf.get(seed.speciesProfileId) ?? null,
            bondText: null,
            mastered: false,
            status: {text: companionStatusLine(line, preview, words).text, kind: statusKind(line, preview)},
            unreadCount: unread,
            muted: conversation?.muted ?? false,
            referralWaiting: false,
            referralId: null,
            hasConversation: Boolean(conversation)
        };
        return {row, activity};
    });
    unbonded.sort((left, right) => {
        const leftUnread = left.row.unreadCount > 0;
        const rightUnread = right.row.unreadCount > 0;
        if (leftUnread !== rightUnread) return leftUnread ? -1 : 1;
        if (left.activity !== right.activity) return right.activity - left.activity;
        return left.row.displayName.localeCompare(right.row.displayName, undefined, {sensitivity: "base"});
    });

    return [...bonded, ...unbonded.map((entry) => entry.row)];
}

/** Unread animal messages across every animal: the Companions tab's badge. */
export function unreadAnimalMessages(conversations: AnimalConversation[]): number {
    return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
}
