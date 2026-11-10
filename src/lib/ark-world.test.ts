import assert from "node:assert/strict";
import test from "node:test";
import {decodeArkStats} from "./ark";
import {
    arkArrivalLine,
    arkMatchArrivals,
    arkPersonView,
    arkScoreShare,
    arkStepOfferFromSnapshot,
    arkStepOfferLine,
    arkWorkedFinishers,
    decodeArkLife,
    decodeArkStepOffer,
    missionIsLocked,
    missionUnlockCollectionPoints,
    readArkScore,
    readArkWorldWeekChange
} from "./ark-world";
import {ARK_COPY} from "./companion-bond";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FOX = id(1);
const words = ARK_COPY;

test("the Ark Score is the world score when the server sends it, the old key only otherwise", () => {
    assert.deepEqual(readArkScore({ark_world_score: 62, ark_score: 142}), {value: 62, outOf: 100, world: true});
    assert.deepEqual(readArkScore({ark_world_score: "50"}), {value: 50, outOf: 100, world: true});
    assert.deepEqual(readArkScore({ark_score: 142}), {value: 142, outOf: 500, world: false});
    assert.deepEqual(readArkScore({ark_world_score: 140}), {value: 100, outOf: 100, world: true});
    assert.equal(readArkScore({}), null);
    assert.equal(readArkScore(null), null);
    assert.equal(arkScoreShare({value: 50, outOf: 100}), 50);
    assert.equal(arkScoreShare({value: 250, outOf: 500}), 50);
});

test("the week's change is read at the top or inside ark_week", () => {
    assert.equal(readArkWorldWeekChange({ark_world_week_change: -3}), -3);
    assert.equal(readArkWorldWeekChange({ark_week: {ark_world_week_change: 4}}), 4);
    assert.equal(readArkWorldWeekChange({ark_week: {ark_score_change: 4}}), null);
});

test("life is the five bars with no total", () => {
    assert.deepEqual(decodeArkLife({money_bar: 60, relationships: 26, energy: 31, reputation: 24, experience: 5}), {moneyBar: 60, relationships: 26, energy: 31, reputation: 24, experience: 5});
    assert.equal(decodeArkLife({}), null);
    assert.equal(decodeArkLife(null), null);
});

test("ark_stats_v1 with the 3.3 keys: the world score, its week, and life standing in for bars", () => {
    const stats = decodeArkStats({
        ark_world_score: 62,
        ark_world_week_change: 5,
        ark_score: 142,
        is_self: true,
        life: {money_bar: 60, relationships: 26, energy: 31, reputation: 24, experience: 5},
        steps: {total: 6, worked: 3, partly: 2, didnt_work: 1}
    });
    assert.ok(stats);
    assert.equal(stats.arkScore, 62);
    assert.equal(stats.arkScoreOutOf, 100);
    assert.equal(stats.arkWorld, true);
    assert.equal(stats.weekChange, 5);
    assert.equal(stats.legacyArkScore, 142);
    assert.deepEqual(stats.bars.money, {bar: 60, balanceCents: null});
    assert.equal(stats.bars.energy, 31);
    // An older server: the old key, out of 500.
    const old = decodeArkStats({ark_score: 142, bars: {experience: 5}});
    assert.equal(old?.arkScoreOutOf, 500);
    assert.equal(old?.arkWorld, false);
    assert.equal(old?.weekChange, null);
});

test("the step's line by state, with an before a vowel in English", () => {
    assert.equal(arkStepOfferLine({state: "new", species: "Red Fox"}, words, "en"), "If this works, a Red Fox comes aboard the Ark");
    assert.equal(arkStepOfferLine({state: "new", species: "Arctic Fox"}, words, "en"), "If this works, an Arctic Fox comes aboard the Ark");
    assert.equal(arkStepOfferLine({state: "pair_complete", species: "Red Fox"}, words, "en"), "If this works, your Red Fox pair will be complete");
    assert.equal(arkStepOfferLine({state: "milestone", species: "Red Fox"}, words, "en"), "If this works, your Red Fox gain a milestone");
    assert.equal(arkArrivalLine("Red Fox", words, "en"), "A Red Fox came aboard the Ark");
    assert.equal(arkArrivalLine("Emu", words, "en"), "An Emu came aboard the Ark");
    // Not English: the plain key.
    assert.equal(arkArrivalLine("Emu", {...words, arrival: "Seekor {species}", arrivalAn: "X"}, "id"), "Seekor Emu");
});

test("voyage_step_offer_state_v1's answer, and the same from the snapshot before it is applied", () => {
    assert.deepEqual(decodeArkStepOffer({state: "pair_complete", species: "Red Fox", living_brought: 1, aboard: 4}), {state: "pair_complete", species: "Red Fox", livingBrought: 1, aboard: 4});
    assert.equal(decodeArkStepOffer({state: "new"}), null);
    // An unknown state reads from the count.
    assert.equal(decodeArkStepOffer({state: "??", species: "Red Fox", living_brought: 5})?.state, "milestone");
    const animal = (n: number, mine: boolean, species = FOX) => ({id: id(100 + n), species_profile_id: species, model_slug: "red-fox", name: "Red Fox", mine, arrived_at: "2026-11-10T10:00:00Z"});
    const species = {speciesProfileId: FOX, slug: "red-fox", name: null};
    assert.equal(arkStepOfferFromSnapshot([], species), null);
    assert.equal(arkStepOfferFromSnapshot([animal(1, false)], species)?.state, "new");
    assert.equal(arkStepOfferFromSnapshot([animal(1, true), animal(2, false)], species)?.state, "pair_complete");
    const capped = arkStepOfferFromSnapshot([animal(1, true), animal(2, true), animal(3, true)], species);
    assert.deepEqual(capped, {state: "milestone", species: "Red Fox", livingBrought: 2, aboard: 3});
    // By slug when the chat's id is not the canonical one.
    assert.equal(arkStepOfferFromSnapshot([animal(1, true, id(9))], {speciesProfileId: id(8), slug: "red-fox", name: "Red Fox"})?.livingBrought, 1);
});

test("an arrival sits under the reply that finished the worked step it came from", () => {
    const messages = [
        {id: "a", role: "assistant", createdAt: "2026-11-10T10:00:00Z", status: "complete", companionEvent: {stepDone: {outcome: "worked"}}},
        {id: "b", role: "assistant", createdAt: "2026-11-10T11:00:00Z", status: "complete", companionEvent: {stepDone: {outcome: "didnt_work"}}},
        {id: "c", role: "assistant", createdAt: "2026-11-10T12:00:00Z", companionEvent: {stepDone: {outcome: "worked"}}},
        {id: "d", role: "user", createdAt: "2026-11-10T12:01:00Z"}
    ];
    const finishers = arkWorkedFinishers(messages);
    assert.deepEqual(finishers.map((finisher) => finisher.id), ["a", "c"]);
    const animal = (n: number, at: string, extra: Partial<{mine: boolean; origin: "arrived" | "born"; species_profile_id: string}> = {}) => ({
        id: id(200 + n), species_profile_id: FOX, model_slug: "red-fox", name: "Red Fox", mine: true, arrived_at: at, ...extra
    });
    const matched = arkMatchArrivals(finishers, [
        animal(1, "2026-11-10T10:00:40Z"),
        animal(2, "2026-11-10T12:00:20Z"),
        animal(3, "2026-11-10T12:00:10Z", {mine: false}),
        animal(4, "2026-11-10T12:00:05Z", {origin: "born"}),
        animal(5, "2026-11-10T10:00:01Z", {species_profile_id: id(7)})
    ], {speciesProfileId: FOX, slug: null});
    assert.equal(matched.get("a")?.id, id(201));
    assert.equal(matched.get("c")?.id, id(202));
    // Too far from any finished step: none.
    assert.equal(arkMatchArrivals(finishers, [animal(6, "2026-11-11T10:00:00Z")], {speciesProfileId: FOX, slug: null}).size, 0);
    // One animal, two steps a minute apart: it goes to the nearer, once.
    const close = arkMatchArrivals([{id: "x", createdAt: "2026-11-10T10:00:00Z"}, {id: "y", createdAt: "2026-11-10T10:01:00Z"}], [animal(7, "2026-11-10T10:00:50Z")], {speciesProfileId: FOX, slug: null});
    assert.deepEqual(Array.from(close.keys()), ["y"]);
});

test("missions open on collection points; an older server's Ark-scale number never opens one on its own", () => {
    const reader = {collectionPoints: 300, tradeUnlocked: false, legacyArkScore: null};
    assert.equal(missionIsLocked({unlock_collection_points: 250, unlock_score_min: 250}, reader), false);
    assert.equal(missionIsLocked({unlock_collection_points: 1000, unlock_score_min: 1000}, reader), true);
    assert.equal(missionIsLocked({unlock_collection_points: 1000, unlocked_at: "2026-11-01"}, reader), false);
    assert.equal(missionIsLocked({unlock_collection_points: 0, requires_trade_unlocked: true}, reader), true);
    assert.equal(missionIsLocked({is_locked: false, unlock_collection_points: 9999}, reader), false);
    // Before 3.3: `unlock_score_min` is on the Ark scale (240 here = 1,200 Overall): never compared with Overall.
    assert.equal(missionIsLocked({unlock_score_min: 240}, reader), true);
    assert.equal(missionIsLocked({unlock_score_min: 240}, {...reader, legacyArkScore: 250}), false);
    assert.equal(missionIsLocked({unlock_score_min: 0}, reader), false);
    assert.equal(missionUnlockCollectionPoints({unlock_collection_points: "1200"}), 1200);
    assert.equal(missionUnlockCollectionPoints({unlock_score_min: 1200}), null);
});

test("/u/{handle}/ark: your own animals, a named person's, or nobody's (anonymous by default)", () => {
    const animal = (n: number, extra: Partial<{mine: boolean; label: string; named: boolean; species: string; slug: string; at: string}> = {}) => ({
        id: id(300 + n),
        species_profile_id: extra.species ?? FOX,
        model_slug: extra.slug ?? "red-fox",
        name: extra.slug === "emu" ? "Emu" : "Red Fox",
        mine: extra.mine ?? false,
        arrived_at: extra.at ?? `2026-11-0${n}T10:00:00Z`,
        brought_by: {label: extra.label ?? "Voyager 3", named: extra.named ?? false}
    });
    const ark = [
        animal(1, {mine: true}),
        animal(2, {mine: true, species: id(9), slug: "emu"}),
        animal(3, {mine: true}),
        animal(4, {label: "ana", named: true}),
        animal(5, {label: "Voyager 9"})
    ];
    const self = arkPersonView(ark, {isSelf: true, username: "lendawg"});
    assert.equal(self.kind, "listed");
    if (self.kind === "listed") {
        assert.equal(self.animals, 3);
        assert.equal(self.named, false);
        assert.equal(self.label, "Voyager 3");
        assert.deepEqual(self.species.map((species) => [species.name, species.count, species.since]), [["Red Fox", 2, "2026-11-01T10:00:00Z"], ["Emu", 1, "2026-11-02T10:00:00Z"]]);
    }
    const named = arkPersonView(ark, {isSelf: false, username: "Ana"});
    assert.equal(named.kind === "listed" ? named.animals : -1, 1);
    // A Voyager number is never tied to a profile; someone else's `mine` is the visitor's, not theirs.
    assert.deepEqual(arkPersonView(ark, {isSelf: false, username: "voyager 9"}), {kind: "anonymous"});
    assert.deepEqual(arkPersonView(ark, {isSelf: false, username: "lendawg"}), {kind: "anonymous"});
    // Your own page with nothing aboard yet still lists (empty), never "anonymous".
    assert.equal(arkPersonView([], {isSelf: true, username: "x"}).kind, "listed");
});
