import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";
import {arkCardDeathAnchor, arkCardDeathLines, decodeArkCardDeath} from "./ark-chat-death";
import {COMPANION_WORDS_EN} from "./companion-bond";

// The quiet line in a card's thread once its Ark animal has died for good (chat-is-Ark, decision 438): drawn from
// voyage_capture_lives_v1, never stored, never the animal's voice.

const ANIMAL = "aaaaaaaa-0000-4000-8000-000000000003";
const gone = {
    ark_hearts: true,
    hearts: 0,
    hearts_max: 3,
    heal_cost: 5,
    status: "gone",
    animal_id: ANIMAL,
    recover_cause: null,
    returns_at: null,
    revives: 2,
    died_at: "2026-11-19T19:36:00Z",
    death_kind: "died_old"
};

test("only a final death on the owner's own card, with hearts on, makes a line", () => {
    assert.equal(decodeArkCardDeath(null), null, "someone else's card");
    assert.equal(decodeArkCardDeath({ark_hearts: false}), null, "hearts off");
    for (const status of ["none", "alive", "recovering"]) assert.equal(decodeArkCardDeath({...gone, status}), null, status);
    assert.equal(decodeArkCardDeath({...gone, died_at: null}), null);
    assert.equal(decodeArkCardDeath({...gone, animal_id: "not-an-id"}), null);
    assert.deepEqual(decodeArkCardDeath(gone), {animalId: ANIMAL, diedAt: gone.died_at, deathKind: "died_old", lives: 3, daysAboard: null});
});

test("how long it lived there comes from when it came aboard, in whole days, at least one", () => {
    assert.equal(decodeArkCardDeath(gone, "2026-11-11T20:43:55Z")?.daysAboard, 8);
    assert.equal(decodeArkCardDeath(gone, "2026-11-19T19:00:00Z")?.daysAboard, 1);
    assert.equal(decodeArkCardDeath(gone, "2026-11-20T00:00:00Z")?.daysAboard, null, "an arrival after the death is not trusted");
    assert.equal(decodeArkCardDeath(gone, "garbage")?.daysAboard, null);
});

test("the words: the plan's line, from the catalogue", () => {
    const words = COMPANION_WORDS_EN.ark;
    const death = decodeArkCardDeath(gone, "2026-11-11T20:43:55Z")!;
    assert.deepEqual(arkCardDeathLines(death, "House Fly", words), {ended: "Your House Fly's life on the Ark has ended.", lived: "It lived there for 8 days."});
    assert.deepEqual(arkCardDeathLines({...death, daysAboard: 1}, "House Fly", words).lived, "It lived there for 1 day.");
    assert.deepEqual(arkCardDeathLines({...death, daysAboard: null}, "House Fly", words).lived, null);
    assert.equal(arkCardDeathLines({...death, daysAboard: 1200}, "House Fly", words).lived, "It lived there for 1,200 days.");
    assert.equal(words.deathSee, "See its kind in the Ark");
});

test("it sits where it happened in the thread", () => {
    const death = decodeArkCardDeath(gone)!;
    const at = (iso: string, id: string) => ({id, createdAt: iso});
    assert.equal(arkCardDeathAnchor(death, []), "end");
    assert.equal(arkCardDeathAnchor(death, [at("2026-11-20T08:00:00Z", "a")]), null, "before every message");
    assert.equal(arkCardDeathAnchor(death, [at("2026-11-18T08:00:00Z", "a"), at("2026-11-19T08:00:00Z", "b"), at("2026-11-20T08:00:00Z", "c")]), "b");
    assert.equal(arkCardDeathAnchor(death, [at("2026-11-18T08:00:00Z", "a"), at("2026-11-19T08:00:00Z", "b")]), "b", "after the newest");
    assert.equal(arkCardDeathAnchor(death, [at("2026-11-18T08:00:00Z", "a"), at("?", "b"), at("2026-11-20T08:00:00Z", "c")]), "b");
});

test("every language has the line's four words, with its placeholders", () => {
    const files = [
        "src/data/locales/en.json",
        "src/data/locales/id.json",
        ...readdirSync("src/data/locales/ark").filter((name) => name.endsWith(".json")).map((name) => `src/data/locales/ark/${name}`)
    ];
    assert.equal(files.length, 45);
    for (const file of files) {
        const ark = JSON.parse(readFileSync(file, "utf8")).companions.ark as Record<string, string>;
        assert.ok(ark.deathEnded?.includes("{species}"), `${file} deathEnded`);
        assert.ok(ark.deathLivedOne?.trim() && !ark.deathLivedOne.includes("{"), `${file} deathLivedOne`);
        assert.ok(ark.deathLivedMany?.includes("{days}"), `${file} deathLivedMany`);
        assert.ok(ark.deathSee?.trim(), `${file} deathSee`);
    }
});
