/**
 * The Companions roster (polish pass, DESIGN.md section 1): a messaging
 * list, not a settings list. What orders the rows and what each row's one
 * line says, pure, so both are tested.
 *
 * Order: what needs you first (an unread message, then an open step, then a
 * referral waiting), each by recency; then every animal with a conversation,
 * newest message first; then animals never talked to, in the server's order.
 * The web has no "check-in due" signal (the bond list carries none), so that
 * case of the SPEC has no rank here.
 *
 * The line: the animal's last words while unread; the step while one is
 * open (drawn in neon with the step glyph); the referral while one waits; the
 * newest message's words, yours or the animal's, for a conversation; else
 * the animal's Power name, which invites better than "Say hello".
 */

import type {CompanionTabRow} from "@/lib/companion-rows";
import type {CompanionWords} from "@/lib/companion-bond";

/** The newest message on the animal's thread in this browser, yours or its (null: none here). */
export type RosterLocalLast = {text: string; at: number} | null;

export type RosterNeed = "unread" | "step" | "referral";

export type RosterLine = {
    kind: RosterNeed | "conversation" | "power" | "hello";
    text: string;
    /** Drawn in neon: something to do. */
    neon: boolean;
};

/** What needs you on this row, if anything. */
export function rosterNeed(row: Pick<CompanionTabRow, "unreadCount" | "openStep" | "referralWaiting">): RosterNeed | null {
    if (row.unreadCount > 0) return "unread";
    if (row.openStep) return "step";
    if (row.referralWaiting) return "referral";
    return null;
}

/** When the row last moved: the newest of the server's times and this browser's thread. */
export function rosterLastAt(row: Pick<CompanionTabRow, "lastActivityAt" | "lastMessage">, local: RosterLocalLast): number | null {
    const times = [row.lastActivityAt, row.lastMessage?.at ?? null, local?.at ?? null].filter((at): at is number => typeof at === "number" && Number.isFinite(at));
    return times.length ? Math.max(...times) : null;
}

/** 1 unread · 2 open step · 3 referral · 4 a conversation · 5 never talked. */
export function rosterRank(row: Pick<CompanionTabRow, "unreadCount" | "openStep" | "referralWaiting" | "hasConversation">, local: RosterLocalLast): 1 | 2 | 3 | 4 | 5 {
    switch (rosterNeed(row)) {
        case "unread": return 1;
        case "step": return 2;
        case "referral": return 3;
        default: return row.hasConversation || local ? 4 : 5;
    }
}

/**
 * The rows in roster order. Stable: rows of one rank with the same recency,
 * and the never-talked rows, keep the order they came in (the server's).
 */
export function sortCompanionRoster<T extends CompanionTabRow>(rows: readonly T[], localLast: (row: T) => RosterLocalLast): T[] {
    const keyed = rows.map((row, index) => {
        const local = localLast(row);
        return {row, index, rank: rosterRank(row, local), at: rosterLastAt(row, local)};
    });
    keyed.sort((left, right) => {
        if (left.rank !== right.rank) return left.rank - right.rank;
        if (left.rank < 5 && left.at !== right.at) return (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY);
        return left.index - right.index;
    });
    return keyed.map((entry) => entry.row);
}

/** The row's one line, truncated by the view with an ellipsis. */
export function rosterLine(row: CompanionTabRow, local: RosterLocalLast, words: CompanionWords): RosterLine {
    const need = rosterNeed(row);
    if (need === "unread" && row.lastMessage?.text) return {kind: "unread", text: row.lastMessage.text, neon: false};
    if (need === "step" && row.openStep) return {kind: "step", text: row.openStep, neon: true};
    if (need === "referral") return {kind: "referral", text: words.list.referralWaiting, neon: true};
    const newest = [row.lastMessage, local].filter((entry): entry is {text: string; at: number} => Boolean(entry?.text)).sort((a, b) => b.at - a.at)[0] ?? null;
    if (newest) return {kind: "conversation", text: newest.text, neon: false};
    if (row.powerName) return {kind: "power", text: row.powerName, neon: false};
    return {kind: "hello", text: words.list.sayHello, neon: false};
}
