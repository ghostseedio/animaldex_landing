import assert from "node:assert/strict";
import test from "node:test";
import {decodeCompanionSummaries} from "@/lib/companion-bond";
import {decodeCompanionCards} from "@/lib/companion-cards";
import {
    animalMessagePreviewText,
    buildCompanionRows,
    decodeAnimalConversations,
    unreadAnimalMessages
} from "@/lib/companion-rows";

const WOLF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOX = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KOALA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTTER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const conversation = (species: string, extra: Record<string, unknown> = {}) => ({
    species_profile_id: species,
    capture_id: `card-${species.slice(0, 4)}`,
    animal_name: "Animal",
    nickname: null,
    last_message_id: "m1",
    last_message_body: null,
    last_message_at: null,
    last_talked_at: null,
    unread_count: 0,
    muted: false,
    talked_days: 1,
    ...extra
});

test("animal_conversations decode one row per species, tolerantly", () => {
    const rows = decodeAnimalConversations([
        conversation(WOLF.toUpperCase(), {unread_count: "2", muted: true, nickname: " Luna "}),
        conversation(WOLF),
        {capture_id: "x"},
        conversation(FOX, {unread_count: -3, capture_id: null})
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].speciesProfileId, WOLF);
    assert.equal(rows[0].unreadCount, 2);
    assert.equal(rows[0].muted, true);
    assert.equal(rows[0].nickname, "Luna");
    assert.equal(rows[1].unreadCount, 0);
    assert.equal(rows[1].captureId, null);
    assert.equal(unreadAnimalMessages(rows), 2);
    assert.deepEqual(decodeAnimalConversations({}), []);
});

test("an animal's message reads as one plain line", () => {
    assert.equal(animalMessagePreviewText("**Snow** came early.\n\n```card\n{\"step\":1}\n```\nDid you get your word in?"), "Snow came early. Did you get your word in?");
    assert.equal(animalMessagePreviewText("```card\nunclosed"), "");
});

test("bond rows keep the server's order and carry what the animal wrote", () => {
    const companions = decodeCompanionSummaries([
        {species_profile_id: WOLF, capture_id: "w1", animal: "Gray Wolf", nickname: "Luna", level: 4, stage: "working_together", unread: 1, slug: "gray-wolf", power: {name: "Pack Pursuit", earned: true}, last_activity: "2026-10-30T10:00:00Z"},
        {species_profile_id: FOX, capture_id: "f1", animal: "Red Fox", level: 2, stage: "getting_to_know_you", referral_waiting: true, referral_id: "8a3c4c55-1d9e-4f3a-9c41-2f1d2b3c4d5e", open_trial: "Walk the long way"},
        {species_profile_id: KOALA, capture_id: "k1", animal: "Koala", level: 1, stage: "met", focus: "Sleep", mastered: true}
    ]);
    const conversations = decodeAnimalConversations([
        // The browser's count wins over the bond list's: the chat was just read.
        conversation(WOLF, {unread_count: 0, last_message_body: "Did you speak first?", last_message_at: "2026-10-31T09:30:00Z", muted: true}),
        conversation(KOALA, {unread_count: 2, last_message_body: "I found a **warm** branch.", last_message_at: "2026-11-01T08:00:00Z"})
    ]);
    const rows = buildCompanionRows({companions, conversations, cards: []});
    assert.deepEqual(rows.map((row) => row.speciesProfileId), [WOLF, FOX, KOALA]);

    const [wolf, fox, koala] = rows;
    assert.equal(wolf.displayName, "Luna the Gray Wolf");
    assert.equal(wolf.unreadCount, 0);
    assert.equal(wolf.muted, true);
    assert.equal(wolf.hasConversation, true);
    assert.equal(wolf.powerName, "Pack Pursuit");
    // The animal's latest message as one plain line, with its time; the newest of the server's times.
    assert.deepEqual(wolf.lastMessage, {text: "Did you speak first?", at: Date.parse("2026-10-31T09:30:00Z")});
    assert.equal(wolf.lastActivityAt, Date.parse("2026-10-31T09:30:00Z"));

    // The referral and the open step, each carried; the referral with its id.
    assert.equal(fox.referralWaiting, true);
    assert.equal(fox.openStep, "Walk the long way");
    assert.equal(fox.referralId, "8a3c4c55-1d9e-4f3a-9c41-2f1d2b3c4d5e");
    assert.equal(fox.hasConversation, false);
    assert.equal(fox.lastActivityAt, null);

    // Unread: the count and the line.
    assert.equal(koala.lastMessage?.text, "I found a warm branch.");
    assert.equal(koala.unreadCount, 2);
    assert.equal(koala.powerName, null);
});

test("animals held before the bond has them follow, newest card each, unread first", () => {
    const companions = decodeCompanionSummaries([
        {species_profile_id: WOLF, capture_id: "w1", animal: "Gray Wolf", level: 3, stage: "trusted"}
    ]);
    const cards = decodeCompanionCards([
        {capture_id: "w2", species_profile_id: WOLF, animal: "Gray Wolf", captured_at: "2026-10-27T00:00:00Z", slug: "gray-wolf"},
        {capture_id: "f-new", species_profile_id: FOX, animal: "Red Fox", nickname: "Rusty", slug: "red-fox", captured_at: "2026-10-26T00:00:00Z"},
        {capture_id: "f-old", species_profile_id: FOX, animal: "Red Fox", slug: "red-fox", captured_at: "2026-10-01T00:00:00Z"},
        {capture_id: "k1", species_profile_id: KOALA, animal: "Koala", slug: "koala", captured_at: "2026-10-20T00:00:00Z"}
    ]);
    const conversations = decodeAnimalConversations([
        conversation(KOALA, {capture_id: "k1", animal_name: "Koala", unread_count: 1, last_message_body: "Slept well?"}),
        // Only its conversation says it is held: it still has a row, drawn by the cards' art when they come.
        conversation(OTTER, {capture_id: "o1", animal_name: "Eurasian Otter", last_talked_at: "2026-10-28T00:00:00Z"}),
        // No card any more: no chat to open, no row.
        conversation("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", {capture_id: null, animal_name: "Okapi"})
    ]);
    const rows = buildCompanionRows({companions, conversations, cards});
    assert.deepEqual(rows.map((row) => row.speciesProfileId), [WOLF, KOALA, OTTER, FOX]);
    const fox = rows[3];
    assert.equal(fox.captureId, "f-new");
    assert.equal(fox.displayName, "Rusty the Red Fox");
    assert.equal(fox.powerName, null);
    assert.equal(fox.slug, "red-fox");
    assert.equal(rows[1].unreadCount, 1);
    assert.equal(rows[1].lastMessage?.text, "Slept well?");
    assert.equal(rows[2].displayName, "Eurasian Otter");
    // The bond row keeps the server's card and finds its art among the cards.
    assert.equal(rows[0].captureId, "w1");
    assert.equal(rows[0].slug, "gray-wolf");
});
