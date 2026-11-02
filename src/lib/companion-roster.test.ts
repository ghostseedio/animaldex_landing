import assert from "node:assert/strict";
import test from "node:test";
import {COMPANION_WORDS_EN} from "@/lib/companion-bond";
import {rosterLastAt, rosterLine, rosterNeed, rosterRank, sortCompanionRoster, type RosterLocalLast} from "@/lib/companion-roster";
import type {CompanionTabRow} from "@/lib/companion-rows";

const T0 = Date.parse("2026-11-02T12:00:00Z");
const hoursAgo = (hours: number) => T0 - hours * 3_600_000;

function row(overrides: Partial<CompanionTabRow> & {speciesProfileId: string}): CompanionTabRow {
    return {
        captureId: `card-${overrides.speciesProfileId}`,
        animal: "Animal",
        displayName: overrides.speciesProfileId,
        slug: null,
        powerName: null,
        openStep: null,
        lastMessage: null,
        lastActivityAt: null,
        unreadCount: 0,
        muted: false,
        referralWaiting: false,
        referralId: null,
        hasConversation: false,
        ...overrides
    };
}

const NO_LOCAL = () => null;

test("the roster puts what needs you first, then conversations by recency, then the never talked to in the server's order", () => {
    const rows = [
        row({speciesProfileId: "owl"}),
        row({speciesProfileId: "fox", openStep: "Walk the long way", lastActivityAt: hoursAgo(30)}),
        row({speciesProfileId: "otter", hasConversation: true, lastMessage: {text: "Play is practice.", at: hoursAgo(72)}}),
        row({speciesProfileId: "bee"}),
        row({speciesProfileId: "wolf", unreadCount: 1, hasConversation: true, lastMessage: {text: "Did you speak first?", at: hoursAgo(0.2)}}),
        row({speciesProfileId: "koala", hasConversation: true, lastMessage: {text: "A warm branch.", at: hoursAgo(5)}}),
        row({speciesProfileId: "hedgehog"}),
        row({speciesProfileId: "deer", referralWaiting: true, referralId: "r1", lastActivityAt: hoursAgo(2)}),
        row({speciesProfileId: "lynx", unreadCount: 2, hasConversation: true, lastMessage: {text: "Still here.", at: hoursAgo(9)}})
    ];
    const sorted = sortCompanionRoster(rows, NO_LOCAL);
    assert.deepEqual(sorted.map((entry) => entry.speciesProfileId), [
        "wolf", "lynx", // unread, newest first
        "fox", // the open step
        "deer", // the referral
        "koala", "otter", // conversations, newest message first
        "owl", "bee", "hedgehog" // never talked to, as the server had them
    ]);
    assert.deepEqual(sorted.map((entry) => rosterRank(entry, null)), [1, 1, 2, 3, 4, 4, 5, 5, 5]);
});

test("a thread kept in this browser counts as a conversation and sets the row's recency", () => {
    const rows = [
        row({speciesProfileId: "owl"}),
        row({speciesProfileId: "bee"}),
        row({speciesProfileId: "otter", hasConversation: true, lastMessage: {text: "Play is practice.", at: hoursAgo(72)}})
    ];
    const local: Record<string, RosterLocalLast> = {bee: {text: "I tried the quiet corner.", at: hoursAgo(1)}};
    const sorted = sortCompanionRoster(rows, (entry) => local[entry.speciesProfileId] ?? null);
    assert.deepEqual(sorted.map((entry) => entry.speciesProfileId), ["bee", "otter", "owl"]);
    assert.equal(rosterLastAt(rows[1], local.bee), hoursAgo(1));
    assert.equal(rosterLastAt(rows[2], null), hoursAgo(72));
    assert.equal(rosterLastAt(rows[0], null), null);
});

test("the row's one line: last words, the step in neon, the referral, the newest message, the Power, then Talk to it", () => {
    const words = COMPANION_WORDS_EN;
    const unread = row({speciesProfileId: "wolf", unreadCount: 1, hasConversation: true, lastMessage: {text: "Did you speak first?", at: hoursAgo(1)}, openStep: "Walk"});
    assert.deepEqual(rosterLine(unread, null, words), {kind: "unread", text: "Did you speak first?", neon: false});
    assert.equal(rosterNeed(unread), "unread");

    const step = row({speciesProfileId: "fox", openStep: "Walk the long way", referralWaiting: true, referralId: "r1"});
    assert.deepEqual(rosterLine(step, null, words), {kind: "step", text: "Walk the long way", neon: true});
    assert.equal(rosterNeed(step), "step");

    const referral = row({speciesProfileId: "deer", referralWaiting: true, referralId: "r1", powerName: "Still Watching"});
    assert.deepEqual(rosterLine(referral, null, words), {kind: "referral", text: "Sent your way: tap to hear its take", neon: true});

    // A conversation: the newest words, the animal's or yours.
    const talked = row({speciesProfileId: "koala", hasConversation: true, lastMessage: {text: "A warm branch.", at: hoursAgo(5)}, powerName: "Eucalyptus Selectivity"});
    assert.deepEqual(rosterLine(talked, null, words), {kind: "conversation", text: "A warm branch.", neon: false});
    assert.deepEqual(rosterLine(talked, {text: "I found mine.", at: hoursAgo(2)}, words), {kind: "conversation", text: "I found mine.", neon: false});
    assert.deepEqual(rosterLine(talked, {text: "An older line.", at: hoursAgo(9)}, words).text, "A warm branch.");

    // Never talked to: its Power invites; without one, "Talk to it".
    const quiet = row({speciesProfileId: "owl", powerName: "Still Watching"});
    assert.deepEqual(rosterLine(quiet, null, words), {kind: "power", text: "Still Watching", neon: false});
    assert.deepEqual(rosterLine(row({speciesProfileId: "bee"}), null, words), {kind: "hello", text: "Talk to it", neon: false});
    assert.equal(rosterNeed(quiet), null);
});
