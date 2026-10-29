import assert from "node:assert/strict";
import test from "node:test";
import {cardsOfSpecies, chatCaptureId, decodeCompanionCards, groupSpeciesTaken, onePerSpecies, toggleGroupPick} from "@/lib/companion-cards";

const WOLF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOX = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("cards decode in the server's order, one per capture, each with a species", () => {
    const cards = decodeCompanionCards([
        {capture_id: "C1", species_profile_id: WOLF.toUpperCase(), animal: "Gray Wolf", nickname: " Luna ", slug: "gray-wolf", captured_at: "2026-10-20T10:00:00Z"},
        {capture_id: "c2", species_profile_id: FOX, animal: "Red Fox", nickname: "", slug: null},
        {capture_id: "c1", species_profile_id: WOLF, animal: "Gray Wolf"},
        {capture_id: "c3", animal: "No species"},
        "oops"
    ]);
    assert.deepEqual(cards.map((card) => card.captureId), ["c1", "c2"]);
    assert.equal(cards[0].speciesProfileId, WOLF);
    assert.equal(cards[0].nickname, "Luna");
    assert.equal(cards[1].nickname, null);
    assert.equal(cards[1].capturedAt, null);
    assert.deepEqual(decodeCompanionCards(null), []);
    assert.deepEqual(cardsOfSpecies(cards, WOLF.toUpperCase()).map((card) => card.captureId), ["c1"]);
    assert.deepEqual(cardsOfSpecies(cards, null), []);
});

test("an animal's chat opens on the card last talked through here, else the server's", () => {
    const said: Record<string, number> = {old: 1_000, newer: 5_000};
    const lastSaid = (id: string) => said[id] ?? null;
    // iOS AnimalMessagesTests: the card with the most recent thread wins.
    assert.equal(chatCaptureId(["fresh", "old", "newer"], lastSaid, "fresh"), "newer");
    // No thread on any of them: the newest card, as the server names it.
    assert.equal(chatCaptureId(["fresh", "other"], lastSaid, "fresh"), "fresh");
    assert.equal(chatCaptureId([], lastSaid, null), null);
    assert.equal(chatCaptureId(["old"], () => Number.NaN, "fresh"), "fresh");
});

test("the group picker takes one card of each species, two to four of them", () => {
    const species: Record<string, string> = {wolf1: WOLF, wolf2: WOLF, fox: FOX, koala: "k", otter: "o", lion: "l"};
    const speciesOf = (id: string) => species[id];
    let picked = toggleGroupPick([], "wolf1", speciesOf, 4);
    assert.deepEqual(picked, ["wolf1"]);
    // A second Gray Wolf is "Already here" and does nothing.
    assert.equal(groupSpeciesTaken(picked, "wolf2", speciesOf), true);
    assert.equal(groupSpeciesTaken(picked, "wolf1", speciesOf), false);
    assert.deepEqual(toggleGroupPick(picked, "wolf2", speciesOf, 4), ["wolf1"]);
    // Unpicking the first frees the species.
    assert.deepEqual(toggleGroupPick(toggleGroupPick(picked, "wolf1", speciesOf, 4), "wolf2", speciesOf, 4), ["wolf2"]);
    for (const id of ["fox", "koala", "otter"]) picked = toggleGroupPick(picked, id, speciesOf, 4);
    assert.deepEqual(picked, ["wolf1", "fox", "koala", "otter"]);
    // Full: nothing more joins.
    assert.deepEqual(toggleGroupPick(picked, "lion", speciesOf, 4), picked);
    assert.deepEqual(
        onePerSpecies([{id: "wolf1", speciesProfileId: WOLF}, {id: "wolf2", speciesProfileId: WOLF}, {id: "fox", speciesProfileId: FOX}]).map((row) => row.id),
        ["wolf1", "fox"]
    );
});
