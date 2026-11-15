import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
    ARK_HEARTS_ENGLISH,
    arkCanRestoreHeart,
    arkDayToTime,
    arkHeartsForScene,
    arkHeartsWhen,
    arkLivesText,
    arkRecoveringAnimals,
    arkTrueArrivals,
    arkWithHearts,
    decodeArkOwnerHearts,
    type ArkOwnerHearts
} from "./ark-hearts";
import {arkLiveLineText, arkLiveServerItems, type ArkLiveText} from "./ark-live-log";
import {decodeArkEventLives, type ArkEvent} from "./ark-life";
import {companionWords, companionWordsForHearts} from "./companion-bond";

const locales = path.join(__dirname, "..", "data", "locales");
const english = JSON.parse(readFileSync(path.join(locales, "en.json"), "utf8"));
const liveWords = english.ark as ArkLiveText;

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";
const HOUR = 3_600_000;

test("en.json's ark.hearts are the English fallback, and every Ark locale has every key with its placeholders", () => {
    assert.deepEqual(english.ark.hearts, ARK_HEARTS_ENGLISH);
    for (const file of readdirSync(path.join(locales, "ark"))) {
        const hearts = JSON.parse(readFileSync(path.join(locales, "ark", file), "utf8")).ark.hearts as Record<string, string>;
        for (const [key, value] of Object.entries(ARK_HEARTS_ENGLISH)) {
            assert.equal(typeof hearts[key], "string", `${file} ark.hearts.${key}`);
            for (const slot of value.match(/\{\w+\}/g) ?? []) assert.ok(hearts[key].includes(slot), `${file} ark.hearts.${key} keeps ${slot}`);
        }
    }
});

test("the return's words follow the notices' rule", () => {
    const now = Date.UTC(2026, 10, 15, 4);
    assert.equal(arkHeartsWhen(now + 0.5 * HOUR, now, ARK_HEARTS_ENGLISH), "within the hour");
    assert.equal(arkHeartsWhen(now + 5 * HOUR, now, ARK_HEARTS_ENGLISH), "in about 5 hours");
    assert.equal(arkHeartsWhen(now + 24 * HOUR, now, ARK_HEARTS_ENGLISH), "tomorrow");
    assert.equal(arkHeartsWhen(now + 72 * HOUR, now, ARK_HEARTS_ENGLISH), "in 3 days");
});

test("lives: 3, 1 and none; restore below 3 only", () => {
    assert.equal(arkLivesText(3, ARK_HEARTS_ENGLISH), "3 lives in the Ark");
    assert.equal(arkLivesText(1, ARK_HEARTS_ENGLISH), "1 life in the Ark");
    assert.equal(arkLivesText(0, ARK_HEARTS_ENGLISH), "No lives left in the Ark");
    assert.equal(arkCanRestoreHeart({hearts: 3}), false);
    assert.equal(arkCanRestoreHeart({hearts: 2}), true);
    assert.equal(arkCanRestoreHeart(null), false);
});

test("an Ark day is 14/365 of a real day after the voyage's start (1 real day of recovery is 26.07 Ark days)", () => {
    const start = "2026-11-01T00:00:00.000Z";
    const at = arkDayToTime(start, 365 / 14)!;
    assert.equal(at - Date.parse(start), 86_400_000);
});

test("the owner's read: bad rows dropped, recovering sorted, a restore raises every animal of that card", () => {
    const now = Date.now();
    const read = decodeArkOwnerHearts({
        healCost: 5,
        animals: {
            [A]: {captureId: CARD, hearts: 1, status: "present"},
            [B]: {captureId: CARD, hearts: 1, status: "recovering", returnsAt: new Date(now + 20 * HOUR).toISOString(), cause: "eaten", name: "Komodo Dragon"},
            "not-an-id": {captureId: CARD, hearts: 2, status: "present"},
            [CARD]: {captureId: "x", hearts: 2, status: "present"}
        }
    }) as ArkOwnerHearts;
    assert.deepEqual(Object.keys(read.animals).sort(), [A, B]);
    assert.deepEqual(arkRecoveringAnimals(read).map((entry) => entry.id), [B]);
    assert.deepEqual(arkHeartsForScene(read), {[A]: 1});
    const after = arkWithHearts(read, CARD, 2);
    assert.equal(after.animals[A].hearts, 2);
    assert.equal(after.animals[B].hearts, 2);
    assert.equal(decodeArkOwnerHearts(null), null);
});

test("an animal back from recovering is not a new arrival", () => {
    const fresh = [{id: "a", arrived_at: "2026-11-10T00:00:00Z"}, {id: "b", arrived_at: "2026-11-15T03:30:00Z"}];
    assert.deepEqual(arkTrueArrivals(fresh, "2026-11-15T04:00:00Z").map((animal) => animal.id), ["b"]);
    assert.equal(arkTrueArrivals(fresh, null).length, 2);
});

function event(partial: Partial<ArkEvent> & Pick<ArkEvent, "id" | "kind">): ArkEvent {
    return {
        serial: Number(partial.id),
        at: "2026-11-15T04:00:00.000Z",
        ark_day: 160,
        species_profile_id: "sp",
        species: null,
        animal: null,
        other: null,
        phrase: null,
        parents: [],
        bringers: [],
        from_egg: false,
        eggs: null,
        thrive: null,
        source: null,
        ...partial
    } as ArkEvent;
}

const komodo = {id: A, name: "Komodo Dragon", species_profile_id: "k"} as unknown as ArkEvent["animal"];
const croc = {id: B, name: "Saltwater Crocodile", species_profile_id: "c"} as unknown as ArkEvent["animal"];

test("the log: an eaten animal it recovers from carries its hearts left; a return is said without a count (the contract)", () => {
    const lives = decodeArkEventLives("eaten", {lives: {heartsLeft: 2, returnsDay: 186}})!;
    const items = arkLiveServerItems([
        event({id: "1", kind: "meal", animal: croc, other: komodo}),
        event({id: "2", kind: "eaten", animal: komodo, other: croc, lives}),
        event({id: "3", kind: "revived", animal: komodo, lives: decodeArkEventLives("revived", {cause: "died_old", heartsLeft: 1, ageReset: true})!}),
        event({id: "4", kind: "revive_failed", animal: komodo})
    ]);
    const text = items.map((item) => arkLiveLineText(item, liveWords, "en"));
    assert.ok(text.includes("Komodo Dragon was eaten by a Saltwater Crocodile · 2 ♥ left"), text.join(" | "));
    assert.ok(text.includes("Komodo Dragon is back, a young adult again"), text.join(" | "));
    assert.ok(text.includes("Komodo Dragon is gone from the Ark"), text.join(" | "));
    assert.ok(text.every((line) => !line.includes("{")), text.join(" | "));
});

test("the log: with no lives in the read (the public read today), a death and a return say no count, never a made-up one", () => {
    const items = arkLiveServerItems([
        event({id: "1", kind: "death_old", animal: komodo}),
        event({id: "2", kind: "revived", animal: komodo})
    ]);
    const text = items.map((item) => arkLiveLineText(item, liveWords, "en"));
    assert.ok(text.every((line) => !line.includes("♥")), text.join(" | "));
    assert.ok(text.includes("Komodo Dragon is back"), text.join(" | "));
});

test("debate words: hearts out of debates says XP and drops the heart lines; Ark hearts speak of lives", () => {
    const words = companionWords(english.companions);
    const same = companionWordsForHearts(words, {heartsInDebates: null, arkHearts: null});
    assert.equal(same, words);
    const off = companionWordsForHearts(words, {heartsInDebates: false, arkHearts: true});
    assert.equal(off.debate.stakeNote, "The community picks the way that fits best. The winner's card gets +10 XP.");
    assert.equal(off.debate.lost, "");
    assert.equal(off.debate.ownOnly, "");
    assert.equal(off.roster.offRoster, "");
    assert.equal(off.debate.draw, "Not enough votes came in.");
    assert.equal(off.heal.one, "Restore a heart · 5 Credits");
    assert.equal(off.heal.full, "3 lives in the Ark");
});
