import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {ARK_BROODS_OFF, ARK_BROOD_ENGLISH, arkBroodCardLine, arkBroodLossStage, arkBroodMemberId, arkBroodOfMember, arkBroodsByParent, decodeArkBroods, type ArkBroodsRead} from "@/lib/ark-broods";
import {rawBrood, rawBroodsRead, rawLoss, type RawBrood} from "@/ark-scene/fixtures/broods";
import {BROOD_EGGS_DRAWN, BROOD_MODELS, BROOD_MODELS_MOST, HATCH_ROCK, LiveBroods, RAID_WALK, broodCareSex, broodDrawn, broodEggLook, broodFlees, broodModels, broodNestlings, broodSpeck, carerPose, eggSpot, hatchPose, nestlingLength, raidPose, type BroodPlace, type BroodSink, type LiveBroodsHost} from "@/ark-scene/live-broods";
import {broodItems, broodRecruitIds, broodRecruits, broodText, isBroodActedRow, isBroodRow} from "@/ark-scene/live/brood-lines";
import {ARK_ACT_HOLD_SECONDS} from "@/lib/ark-act-hold";
import {setRecordedSexes} from "@/ark-scene/behaviour-recipes";
import type {ActPose} from "@/ark-scene/acts";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkLiveText} from "@/lib/ark-live-log";

const T0 = Date.UTC(2026, 10, 20, 10) / 1000;
const DAY = 470;
const A = "0000feed-0000-4000-8000-000000000000";
const B = "0000feed-0000-4000-8000-000000000001";
const HUNTER = {id: "0000feed-0000-4000-8000-000000000100", species_profile_id: "5bec1e50-0000-4000-8000-000000000001", name: "Grey Heron", model_slug: "grey-heron"};
const ID = "b100d000-0000-4000-8000-000000000001";
const mallard = (given: Partial<RawBrood> = {}): RawBrood => rawBrood({id: ID, name: "Mallard", model_slug: "mallard", parents: [A, B], stage: "egg", count: 9, start: 9, zone: "wetland", care: "follow", hold: "sit", laid_ark_day: DAY - 10, stage_ark_day: DAY - 10, ...given});
const read = (epoch: number, broods: RawBrood[], ended: RawBrood[] = []): ArkBroodsRead => decodeArkBroods(JSON.parse(JSON.stringify(rawBroodsRead(epoch, DAY, broods, ended))));
const an = (name: string) => `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
// (The record's sexes, as a snapshot carries them: A the duck, B the drake; the duck sits and leads, `broodCareSex`.)
setRecordedSexes([{id: A, sex: "f"}, {id: B, sex: "m"}]);

// MARK: The read

test("the read: off, absent or malformed is ARK_BROODS_OFF (the scene then loads nothing)", () => {
    for (const raw of [null, undefined, 3, "on", [], {}, {on: false, broods: [], ended: []}, {on: "true", broods: []}, {on: true}, {on: true, broods: "x"}]) assert.equal(decodeArkBroods(raw), ARK_BROODS_OFF);
    assert.equal(ARK_BROODS_OFF.on, false);
    assert.throws(() => ((ARK_BROODS_OFF as {on: boolean}).on = true), "frozen: shared and never changed");
});

test("the read: the contract's own example decodes field for field", () => {
    const raw = {
        on: true, as_of: "2026-12-01T10:00:00Z", ark_day: 480.25,
        broods: [{
            id: ID, kind: "kind-1", species_profile_id: "look-1", name: "Mallard", model_slug: "mallard", parents: [A, B], carer: A, care: "follow", hold: "sit", way: "mating", way_detail: null,
            stage: "egg", count: 7, start: 9, stage_count: 9, taken: 2, lost: 0, laid_ark_day: 471, stage_ark_day: 471, next_ark_day: 499, island: "wild", zone: "wetland", nest: {slot: 12, slot_rank: 3}, young_mass_g: 38,
            losses: [
                {id: 991, at: "2026-12-01T09:00:00Z", ark_day: 476.4, cause: "taken", count: 2, left: 7, hunter: HUNTER, encounter: {t: 1764500000.12, step: 45736, island: "wild", predator: {x: 10.2, z: -4.1}, prey: {x: 12, z: -3, r: 2.5}, d: 2.1}},
                {id: 987, at: "2026-12-01T08:00:00Z", ark_day: 475, cause: "did_not_survive", count: 1, left: 9, hunter: null}
            ]
        }],
        ended: []
    };
    const got = decodeArkBroods(raw);
    assert.equal(got.on, true);
    assert.equal(got.ark_day, 480.25);
    const b = got.broods[0];
    assert.deepEqual({id: b.id, kind: b.kind, carer: b.carer, care: b.care, hold: b.hold, stage: b.stage, count: b.count, start: b.start, nest: b.nest, island: b.island}, {id: ID, kind: "kind-1", carer: A, care: "follow", hold: "sit", stage: "egg", count: 7, start: 9, nest: {slot: 12, slot_rank: 3}, island: "wild"});
    assert.equal(b.losses.length, 2);
    assert.deepEqual(b.losses[0].hunter, HUNTER);
    assert.deepEqual(b.losses[0].encounter, {t: 1764500000.12, predator: {x: 10.2, z: -4.1}, prey: {x: 12, z: -3, r: 2.5}});
    assert.equal(b.losses[1].hunter, null);
    assert.equal(b.outcome, null);
});

test("the read: never more than it started with, a carer only among its parents, bad rows dropped, nothing private kept", () => {
    const got = decodeArkBroods({on: true, as_of: "2026-12-01T10:00:00Z", ark_day: 480, broods: [
        {...mallard(), count: 99, carer: "someone-else", user_id: "u-1", bringers: ["@ada"], fate: 0.4},
        {...mallard(), id: "no-stage", stage: "ended"},
        {...mallard(), id: "no-model", model_slug: null},
        {...mallard(), id: "huge", count: 3e9},
        {...mallard()},
        "junk"
    ], ended: []});
    assert.equal(got.broods.length, 1, "a duplicate id, an unknown stage, no model and an impossible count are dropped");
    const b = got.broods[0] as unknown as Record<string, unknown>;
    assert.equal(b.count, 9);
    assert.equal(b.carer, null);
    for (const key of ["user_id", "bringers", "fate"]) assert.equal(key in b, false);
});

test("the read as the engine builds it (voyage_brood_public): an ended brood has no stage, a census loss no id; both still drawn", () => {
    // (Field for field as jsonb_strip_nulls leaves them: hold, way_detail, nest, young_mass_g, outcome dropped when null; census rows' event id null.)
    const at = (m: number) => new Date((T0 + m * 60) * 1000).toISOString().replace(/\.\d+Z$/, "Z");
    const raw = {
        on: true, as_of: at(0), ark_day: DAY,
        broods: [{
            id: ID, kind: "k", species_profile_id: "s", name: "Mallard", model_slug: "mallard", way: "mating", care: "follow", stage: "young", island: "wild", zone: "wetland",
            parents: [A, B], carer: null, count: 5, start: 9, stage_count: 7, taken: 2, lost: 2, recruited: 0, unsettled: 0, laid_ark_day: DAY - 40, stage_ark_day: DAY - 12, next_ark_day: DAY + 30, unguarded: true,
            losses: [
                {at: at(-1), ark_day: DAY - 0.2, cause: "did_not_survive", count: 2, left: 5, stage: "young"},
                {id: 991, at: at(-30), ark_day: DAY - 5, cause: "taken", count: 2, left: 7, stage: "egg", egg: true, hunter: HUNTER}
            ]
        }],
        ended: [
            // A nest that failed in its eggs.
            {id: "e1", kind: "k", species_profile_id: "s", name: "American Robin", model_slug: "american-robin", way: "mating", care: "nest", hold: "sit", outcome: "failed", ended_ark_day: DAY - 0.1, island: "wild", zone: "farm_garden", nest: {slot: 4, slot_rank: 0},
                parents: [A, A], carer: A, count: 0, start: 4, stage_count: 4, taken: 0, lost: 4, recruited: 0, unsettled: 0, laid_ark_day: DAY - 5, stage_ark_day: DAY - 5, next_ark_day: DAY + 8, unguarded: false,
                losses: [{id: 995, at: at(-2), ark_day: DAY - 0.1, cause: "failed", count: 4, left: 0, stage: "egg"}]},
            // Young on their own: 3 recruited (each `birth` took one off the count), 2 did not settle.
            {id: "e2", kind: "k", species_profile_id: "s", name: "Mallard", model_slug: "mallard", way: "mating", care: "follow", outcome: "independent", ended_ark_day: DAY, island: "wild", zone: "wetland",
                parents: [A, B], carer: A, count: 0, start: 9, stage_count: 5, taken: 2, lost: 2, recruited: 3, unsettled: 2, laid_ark_day: DAY - 60, stage_ark_day: DAY - 32, next_ark_day: DAY, unguarded: false,
                losses: [{id: 996, at: at(-1), ark_day: DAY, cause: "unsettled", count: 2, left: 3, stage: "young"}]},
            // Ended with no loss that says its stage (closed): a stage change after laying made it young.
            {id: "e3", kind: "k", species_profile_id: "s", name: "Mallard", model_slug: "mallard", outcome: "closed", ended_ark_day: DAY, parents: [A, B], carer: null, count: 4, start: 4, stage_count: 4, taken: 0, lost: 0, recruited: 0, unsettled: 0, laid_ark_day: DAY - 30, stage_ark_day: DAY - 2, next_ark_day: DAY + 9, unguarded: false, losses: []}
        ]
    };
    const got = decodeArkBroods(raw);
    assert.equal(got.broods.length, 1);
    assert.equal(got.ended.length, 3, "no ended brood is dropped for having no stage");
    const live = got.broods[0];
    assert.equal(live.losses.length, 2, "the census loss is kept");
    assert.match(live.losses[0].id, /^census:/);
    assert.equal(decodeArkBroods(JSON.parse(JSON.stringify(raw))).broods[0].losses[0].id, live.losses[0].id, "the same census loss has the same id in the next read: acted once");
    assert.equal(live.losses[1].stage, "egg");
    assert.deepEqual({unguarded: live.unguarded, recruited: live.recruited, carer: live.carer, hold: live.hold, nest: live.nest}, {unguarded: true, recruited: 0, carer: null, hold: null, nest: null});
    const [failed, independent, closed] = got.ended;
    assert.deepEqual([failed.stage, independent.stage, closed.stage], ["egg", "young", "young"]);
    assert.equal(failed.outcome, "failed");
    assert.deepEqual(failed.parents, [A, A], "a solo breeder names itself twice");
    assert.deepEqual(arkBroodCardLine(failed, null, "en", an).notes, ["The nest failed"]);
    const line = arkBroodCardLine(independent, null, "en", an);
    assert.equal(line.head, "5 young · 3 left", "its recruits are what is left of it, not the read's count of 0");
    assert.deepEqual(line.notes.slice(0, 2), ["3 now on their own", "2 did not settle"]);
});

test("a loss's stage: the read's own word, else from the days (eggs of a brood since hatched)", () => {
    const young = {stage: "young" as const, laid_ark_day: 460, stage_ark_day: 470};
    assert.equal(arkBroodLossStage(young, {stage: null, ark_day: 465}), "egg");
    assert.equal(arkBroodLossStage(young, {stage: null, ark_day: 471}), "young");
    assert.equal(arkBroodLossStage(young, {stage: "young", ark_day: 465}), "young");
    assert.equal(arkBroodLossStage({stage: "egg", laid_ark_day: 460, stage_ark_day: 460}, {stage: null, ark_day: 461}), "egg");
    // A live birth was never an egg.
    assert.equal(arkBroodLossStage({stage: "young", laid_ark_day: 470, stage_ark_day: 470}, {stage: null, ark_day: 469}), "young");
});

test("a stand-in's id is never an animal's, and names its brood", () => {
    const id = arkBroodMemberId(ID, 3);
    assert.equal(id.includes(":"), true);
    assert.equal(arkBroodOfMember(id), ID);
    assert.equal(arkBroodOfMember(A), null);
    assert.equal(arkBroodOfMember(`brood:${ID}:x991`), ID, "the eaten one of a crowd too");
    assert.equal(arkBroodOfMember(null), null);
});

test("the card: how many, how many left, who took them; losses with no cause said as recorded, never a cause made up", () => {
    const b = mallard({count: 6, taken: 2, lost: 1});
    b.losses = [rawLoss(3, T0, DAY, "did_not_survive", 1, 6), rawLoss(2, T0 - 60, DAY, "taken", 1, 7, HUNTER), rawLoss(1, T0 - 120, DAY, "taken", 1, 8, HUNTER)];
    const got = read(T0, [b]);
    const mine = arkBroodsByParent(got).get(A)!;
    assert.equal(mine.length, 1);
    assert.equal(arkBroodsByParent(got).get(B)!.length, 1, "both parents' cards");
    const line = arkBroodCardLine(mine[0], null, "en", an);
    assert.equal(line.head, "9 eggs · 6 left");
    assert.deepEqual(line.notes, ["2 taken by a Grey Heron", "1 did not survive"]);
    assert.equal(arkBroodCardLine(read(T0, [mallard()]).broods[0], null, "en", an).head, "9 eggs");
    assert.equal(arkBroodCardLine(read(T0, [mallard({stage: "young", count: 5, stage_count: 7, stage_ark_day: DAY})]).broods[0], null, "en", an).head, "7 young · 5 left");
    assert.equal(arkBroodCardLine(read(T0, [mallard({stage: "carried", count: 4, start: 4})]).broods[0], null, "en", an).head, "Carrying 4 young");
    assert.equal(arkBroodCardLine(read(T0, [mallard({count: 1200, start: 1200})]).broods[0], null, "en", an).head, "1,200 eggs", "the whole count is the card's, whatever the world draws");
    const failed = read(T0, [], [mallard({count: 0, outcome: "failed", ended_ark_day: DAY, losses: [rawLoss(9, T0, DAY, "failed", 9, 0)]})]).ended[0];
    assert.deepEqual(arkBroodCardLine(failed, null, "en", an).notes, ["The nest failed"]);
    for (const text of [line.head, ...line.notes, ...Object.values(ARK_BROOD_ENGLISH)]) assert.doesNotMatch(text, /died|killed|starv|disease|cold/i);
    // A bundle's own words win; a missing one reads English.
    assert.equal(arkBroodCardLine(mine[0], {eggs: "{start} œufs · {left} restants"}, "fr", an).head, "9 œufs · 6 restants");
});

// MARK: What is drawn

test("never more than the count is drawn, and a take from a clutch of thousands is still seen", () => {
    for (const cap of [6, 24, 60]) {
        for (const of of [1, 4, 9, 24, 25, 60, 1200, 2_000_000]) {
            let last = Infinity;
            for (let count = of; count >= 0; count -= Math.max(1, Math.floor(of / 97))) {
                const drawn = broodDrawn(count, of, cap);
                assert.ok(drawn <= count, `${drawn} drawn of ${count}`);
                assert.ok(drawn <= cap);
                assert.ok(drawn <= last, "monotone in the count");
                if (count > 0) assert.ok(drawn >= 1);
                last = drawn;
            }
            assert.equal(broodDrawn(0, of, cap), 0);
        }
    }
    assert.equal(broodDrawn(4, 4, 24), 4, "a small clutch: every egg");
    assert.equal(broodDrawn(1200, 1200, 60), 60);
    assert.equal(broodDrawn(900, 1200, 60), 45, "a quarter taken: a quarter fewer drawn");
});

test("the looks follow the MODEL's plan (ark.json behaviour.plan), never a rig contract name", () => {
    const brood = {way: "mating", way_detail: null, care: "nest" as const, hold: "sit" as const, model_slug: "american-robin"};
    assert.deepEqual(broodEggLook(brood, "bird", false), {nest: "nest", egg: "speckled", cap: BROOD_EGGS_DRAWN, layout: "heap"});
    assert.equal(broodEggLook({...brood, care: "follow"}, "bird", true)?.nest, "scrape", "a duck's scrape, also when its home is on the water");
    assert.equal(broodEggLook({...brood, model_slug: "mugger-crocodile", care: "guard"}, "reptile", true)?.nest, "scrape", "a crocodile lays on land");
    assert.equal(broodEggLook({...brood, model_slug: "common-frog", way: "amplexus", care: "none"}, "frog", true)?.layout, "clump");
    assert.equal(broodEggLook({...brood, model_slug: "american-toad", way: "amplexus", care: "none"}, "frog", true)?.layout, "string");
    assert.equal(broodEggLook({...brood, model_slug: "three-spined-stickleback", way: "spawn_pair", way_detail: "nest", care: "guard"}, "fish", true)?.layout, "patch");
    assert.equal(broodEggLook({...brood, model_slug: "carolina-wolf-spider", care: "carry"}, "arthropod", false)?.egg, "sac");
    // Nothing lasting for drifting spawn; nothing outside the parent for a mouthbrooder or a pouch.
    for (const [way, detail] of [["broadcast", null], ["brooding", null], ["male_pregnancy", null], ["spawn_pair", "mouthbrood"], ["spawn_pair", "pouch"]] as const) assert.equal(broodEggLook({...brood, way, way_detail: detail}, "fish", true), null);
    // The young: the kind's own model only where a small adult is the young; a tadpole or a larva is a speck.
    for (const plan of ["mammal", "bird", "reptile", "snake", "turtle", "fish"]) assert.equal(broodModels({care: "none"}, plan), true, plan);
    for (const plan of ["frog", "arthropod", "insect", "sessile", "worm", null]) assert.equal(broodModels({care: "none"}, plan), false, String(plan));
    // The rig contract's names are not plans: nothing matches them (the scene would do nothing, so the test must say so).
    for (const rig of ["quadruped", "biped", "avian", "serpent", "hexapod", "piscine"]) {
        assert.equal(broodModels({care: "none"}, rig), false, rig);
        assert.equal(broodFlees({care: "follow"}, rig), false, rig);
        assert.equal(broodSpeck(rig, false), "grub", rig);
    }
    assert.equal(broodModels({care: "carry"}, "arthropod"), true, "carried young ride with their own model");
    assert.equal(broodFlees({care: "follow"}, "bird"), true);
    assert.equal(broodFlees({care: "nest"}, "bird"), false, "nestlings are taken where they are: a raid, not a chase");
    assert.deepEqual([broodSpeck("frog", true), broodSpeck("fish", true), broodSpeck("bird", true), broodSpeck("mammal", false), broodSpeck("arthropod", false), broodSpeck("reptile", true)], ["tadpole", "fry", "oval", "four", "grub", "scaly"], "a duckling on the water is still a duckling; a hatchling crocodile is no grub");
    // Every plan the models carry (2,632 local ark.json, 2026-11-27) draws its young somehow, and its eggs unless they drift.
    const every: Record<string, {models: boolean; speck: string; egg: string | null}> = {
        mammal: {models: true, speck: "four", egg: "shell"}, bird: {models: true, speck: "oval", egg: "speckled"}, arthropod: {models: false, speck: "grub", egg: "shell"},
        fish: {models: true, speck: "fry", egg: "spawn"}, reptile: {models: true, speck: "scaly", egg: "shell"}, butterfly: {models: false, speck: "grub", egg: "shell"},
        turtle: {models: true, speck: "scaly", egg: "shell"}, snake: {models: true, speck: "scaly", egg: "shell"}, slow_invertebrate: {models: false, speck: "grub", egg: "shell"},
        frog: {models: false, speck: "tadpole", egg: "spawn"}, cetacean: {models: true, speck: "fry", egg: "spawn"}, sessile: {models: false, speck: "fry", egg: "spawn"},
        cephalopod: {models: false, speck: "fry", egg: "spawn"}, eel: {models: true, speck: "fry", egg: "spawn"}, ray: {models: true, speck: "fry", egg: "spawn"},
        jellyfish: {models: false, speck: "fry", egg: "spawn"}, worm: {models: false, speck: "grub", egg: "shell"}, flatfish: {models: true, speck: "fry", egg: "spawn"}
    };
    for (const [plan, want] of Object.entries(every)) {
        const water = want.speck === "fry";
        const got = {models: broodModels({care: "none"}, plan), speck: broodSpeck(plan, water), egg: broodEggLook({...brood, model_slug: `x-${plan}`, care: "none", hold: null}, plan, water)?.egg ?? null};
        assert.deepEqual(got, want, plan);
    }
});

test("eggs keep their places as the clutch thins (the k-th egg does not move when another goes)", () => {
    for (const layout of ["heap", "clump", "string", "patch"] as const) {
        const before = eggSpot(layout, 2, 9, 0.3);
        assert.deepEqual(eggSpot(layout, 2, 9, 0.3), before);
        for (let k = 0; k < 60; k++) {
            const p = eggSpot(layout, k, 60, 0.7);
            assert.ok(Math.hypot(p.x, p.z) < 2.2 && Number.isFinite(p.y));
        }
    }
});

const NEST: BroodPlace = {x: 10, z: 20, y: 0.5, top: 0.5, yaw: 0, water: false};

test("the attending parent: on its eggs, beside them, or fanning them, for as long as it is asked", () => {
    for (const epoch of [T0, T0 + 3600, T0 + 86400 * 3]) {
        const sit = carerPose("sit", false, NEST, 0.5, ID, epoch);
        assert.deepEqual([sit.x, sit.z, sit.state], [10, 20, "rest"]);
        assert.ok(sit.base <= 0.5 && sit.base > 0.4, "low in the cup");
        const guard = carerPose("guard", false, NEST, 0.5, ID, epoch);
        assert.ok(Math.abs(Math.hypot(guard.x - 10, guard.z - 20) - 0.45) < 1e-9);
        assert.equal(guard.state, "scan");
        const fan = carerPose("guard", true, {...NEST, water: true}, 0.08, ID, epoch);
        assert.equal(fan.state, "swim");
        assert.ok(fan.base > NEST.y && fan.pitch > 0, "over the eggs, head down to them");
    }
    const a = carerPose("guard", true, NEST, 0.08, ID, T0).pitch;
    const b = carerPose("guard", true, NEST, 0.08, ID, T0 + 0.3).pitch;
    assert.notEqual(a, b, "the fanning moves");
});

test("a raid: the hunter comes to the brood, feeds there, and goes back to its day", () => {
    const from = {x: 0, z: 20, y: 0, yaw: 0};
    const ground = () => 0;
    const at = (s: number) => raidPose(s, 6, from, from, {...NEST, y: 0}, 1, 0.3, 1, false, ground);
    assert.equal(at(1)!.state, "walk");
    assert.ok(at(1)!.x < at(8)!.x, "towards the nest");
    const feeding = at(RAID_WALK + 2)!;
    assert.equal(feeding.state, "eat");
    assert.equal(feeding.meal, "eating");
    assert.ok(Math.hypot(feeding.x - 10, feeding.z - 20) < 1, "at the nest's edge");
    assert.equal(at(RAID_WALK + 6 + 3)!.state, "walk");
    assert.equal(at(RAID_WALK + 6 + 60), null, "back at its day: its own again");
    // Too far to walk in the time: it is at the nest from the start.
    const far = raidPose(1, 6, {x: -900, z: 20, y: 0, yaw: 0}, null, {...NEST, y: 0}, 1, 0.3, 1, false, ground)!;
    assert.ok(Math.hypot(far.x - 10, far.z - 20) < 1);
});

test("who attends: the sex that sits and leads in its kind (a duck, not the drake; an emu's father; a mammal's mother)", () => {
    assert.equal(broodCareSex({model_slug: "mallard", kind: "k"}, "bird"), "female", "a mallard duck incubates and leads the ducklings");
    assert.equal(broodCareSex({model_slug: "american-robin", kind: "k"}, "bird"), "female", "a robin's female incubates");
    assert.equal(broodCareSex({model_slug: "emu", kind: "k"}, "bird"), "male", "an emu's father sits (its recipe's maleSits)");
    assert.equal(broodCareSex({model_slug: "red-fox", kind: "k"}, "mammal"), "female");
    assert.equal(broodCareSex({model_slug: "rock-dove", kind: "k"}, "bird"), null, "both sit: the engine's carer as it is");
});

test("hatchlings come out scattered, each its own way; some make for the parent or the water", () => {
    const n = 6;
    const target = {x: 14, z: 20};
    const at = (s: number) => Array.from({length: n}, (_, k) => hatchPose(s, k, n, NEST, 0.6, ID, [target])!);
    // (All out of the egg by then: the last comes out up to 2.4 s after the first, and takes 1.4 s to be clear.)
    const out = at(HATCH_ROCK + 3.9);
    const bearings = out.map((p) => Math.atan2(p.x - NEST.x, p.z - NEST.z)).sort((a, b) => a - b);
    const gaps = bearings.map((b, i) => (i ? b - bearings[i - 1] : b + 2 * Math.PI - bearings[n - 1]));
    assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.3, "not evenly spaced round the nest");
    const radii = out.map((p) => Math.hypot(p.x - NEST.x, p.z - NEST.z));
    assert.ok(Math.max(...radii) - Math.min(...radii) > 0.05, "not on one ring");
    const later = at(11.5);
    assert.ok(later.some((p) => Math.hypot(p.x - target.x, p.z - target.z) < Math.hypot(NEST.x - target.x, NEST.z - target.z) - 0.1), "some head for the parent");
    assert.deepEqual(at(HATCH_ROCK + 3.9).map((p) => [p.x, p.z]), out.map((p) => [p.x, p.z]), "the same for every viewer");
});

test("nestlings are heads and gapes in the cup, not small birds: their size honest to the parent's", () => {
    assert.equal(broodNestlings({care: "nest"}, "bird"), true);
    assert.equal(broodModels({care: "nest"}, "bird"), false, "no stand-in model sits in the cup");
    assert.equal(broodNestlings({care: "follow"}, "bird"), false, "ducklings are walking models");
    assert.equal(nestlingLength(0.25, 0), 0.25 * 0.26);
    assert.ok(nestlingLength(0.25, 1) < 0.25 && nestlingLength(0.25, 1) > nestlingLength(0.25, 0.5));
    assert.equal(nestlingLength(0.25, 5), nestlingLength(0.25, 1));
});

// MARK: The layer

type E = {id: string; act: ActPose | null; x: number; z: number};

function world(tier: "high" | "medium" | "low" = "high", chases = true, plans: Record<string, string> = {mallard: "bird", "grey-heron": "bird", "common-frog": "frog", "red-fox": "mammal", "american-robin": "bird"}, waterTop: (x: number, z: number) => number = () => 0, ground: (x: number, z: number) => number = () => 0) {
    const entries = new Map<string, E>();
    const meals: Array<{predator: string; prey: string; at: string}> = [];
    const dropped: string[] = [];
    let relayouts = 0;
    const host: LiveBroodsHost<E> = {
        find: (id) => entries.get(id) ?? null,
        out: (id) => entries.has(id),
        plan: (slug) => plans[slug] ?? null,
        place: (animals) => new Map(animals.map((a) => [a.id, {...NEST, y: 0, top: 0}])),
        adultLength: () => 0.5,
        body: (e) => ({x: e.act?.x ?? e.x, z: e.act?.z ?? e.z, base: 0, yaw: 0, length: 0.5}),
        scheduleAt: (e) => ({x: e.x, z: e.z, y: 0, yaw: 0}),
        ground,
        waterTop,
        walk: () => 1,
        flies: () => false,
        setAct: (e, pose) => void (e.act = pose),
        busy: () => false,
        addMeals: (acts) => void meals.push(...acts.map((m) => ({predator: m.predator.id, prey: m.prey.id, at: m.at}))),
        catchAt: (predator, prey) => (chases ? T0 + 60 + ARK_ACT_HOLD_SECONDS + 6 : (void predator, void prey, null)),
        dropMeal: (predator, prey) => void dropped.push(`${predator}>${prey}`),
        relayout: () => void relayouts++
    };
    const layer = new LiveBroods<E>(host);
    layer.tier = tier;
    const drawn = {nests: 0, eggs: 0, specks: 0};
    const sink: BroodSink = {nest: () => void drawn.nests++, egg: () => void drawn.eggs++, speck: () => void drawn.specks++, nestling: () => void drawn.specks++};
    const base = {animals: [{id: A, model_slug: "mallard"}, {id: B, model_slug: "mallard"}, {id: HUNTER.id, model_slug: "grey-heron"}] as unknown as ArkAnimal[]} as ArkSnapshot;
    const add = (id: string, x = 0, z = 0) => void entries.set(id, {id, act: null, x, z});
    /** The scene's side of a layout: every roster animal (the stand-ins too) gets an entry. */
    const layout = () => {
        const roster = layer.roster(base);
        for (const animal of roster.animals) if (!entries.has(animal.id)) add(animal.id, 10, 20);
        for (const id of Array.from(entries.keys())) if (!roster.animals.some((a) => a.id === id)) entries.delete(id);
        return roster;
    };
    const step = (epoch: number) => {
        drawn.nests = drawn.eggs = drawn.specks = 0;
        layer.step(epoch, sink, null, Infinity);
        return {...drawn};
    };
    return {layer, entries, meals, dropped, base, add, layout, step, relayouts: () => relayouts};
}

test("a parent guarding a body length off its eggs stands on what is there: a slope's ground, or the water's top at a bank", () => {
    // (The nest at (10, 20) in a hollow: the ground rising half a metre a metre all round it; in the second world a pond's
    // top 0.3 m up from 0.3 m out, over a bed 0.1 m up.)
    const out = (x: number, z: number) => Math.hypot(x - 10, z - 20);
    for (const pond of [false, true]) {
        const ground = (x: number, z: number) => (pond ? Math.min(out(x, z) * 0.5, 0.1) : out(x, z) * 0.5);
        const top = (x: number, z: number) => (pond && out(x, z) > 0.3 ? 0.3 : -1);
        const w = world("high", true, undefined, top, ground);
        w.layer.set(read(T0, [mallard({laid_ark_day: DAY, stage_ark_day: DAY, hold: "guard"})]), T0);
        w.layout();
        let checked = 0;
        for (let t = 30; t <= 600; t += 37) {
            w.step(T0 + t);
            const act = w.entries.get(A)!.act!;
            if (act.state === "walk") continue;
            assert.ok(out(act.x, act.z) > 0.3, "a body length off the eggs");
            const under = top(act.x, act.z) > ground(act.x, act.z) ? top(act.x, act.z) : ground(act.x, act.z);
            assert.ok(Math.abs(act.base - under) < 1e-9, `on what is under it at t ${t}: ${act.base}, not ${under}`);
            assert.equal(act.state, pond ? "swim" : "scan");
            checked++;
        }
        assert.ok(checked > 5);
    }
});

test("off: no stand-ins, the roster is the read itself, nothing drawn, nothing posed", () => {
    const w = world();
    w.layer.set(ARK_BROODS_OFF, T0);
    assert.equal(w.layer.size, 0);
    assert.equal(w.layer.roster(w.base), w.base, "the very same object: nothing is laid out again");
    w.layout();
    assert.deepEqual(w.step(T0), {nests: 0, eggs: 0, specks: 0});
    assert.equal(w.entries.get(A)!.act, null);
    assert.deepEqual(w.layer.pins(T0), []);
});

test("eggs: the record's count where it was laid, the parent on them; a clutch seen laid comes egg by egg", () => {
    const w = world();
    w.layer.set(read(T0, [mallard({laid_ark_day: DAY, stage_ark_day: DAY})]), T0);
    w.layout();
    assert.equal(w.layer.roster(w.base), w.base, "eggs are no animals");
    assert.equal(w.step(T0 + 0.1).eggs < 9, true, "the first moment: not all laid yet");
    const later = w.step(T0 + 30);
    assert.deepEqual({nests: later.nests, eggs: later.eggs}, {nests: 1, eggs: 9});
    const sitter = w.entries.get(A)!;
    assert.equal(sitter.act?.state, "rest");
    assert.deepEqual([sitter.act!.x, sitter.act!.z], [10, 20], "on the nest, the record's place");
    assert.equal(w.entries.get(B)!.act, null, "only the attending parent");
    // Still there a real day later (the whole egg stage), and let go when the read no longer has the brood.
    w.step(T0 + 86400);
    assert.equal(w.entries.get(A)!.act?.state, "rest");
    w.layer.set(read(T0 + 86400, []), T0 + 86400);
    w.step(T0 + 86401);
    assert.equal(w.entries.get(A)!.act, null);
});

test("the engine's carer is the drake: the duck of the pair sits; a pair with no duck out has no sitter drawn", () => {
    const w = world();
    w.layer.set(read(T0, [mallard({carer: B})]), T0);
    w.layout();
    w.step(T0 + 30);
    assert.equal(w.entries.get(A)!.act?.state, "rest", "the duck on the eggs");
    assert.equal(w.entries.get(B)!.act, null, "never the drake");
    w.entries.delete(A);
    w.step(T0 + 31);
    assert.equal(w.entries.get(B)!.act, null, "the duck not out: no drake sitting in her place");
});

test("a nest raid is acted: the hunter pinned, at the nest, and the record's count of eggs goes one by one", () => {
    const w = world();
    w.layer.set(read(T0, [mallard()]), T0);
    w.layout();
    assert.equal(w.step(T0 + 5).eggs, 9);
    const b = mallard({count: 6, taken: 3});
    b.losses = [rawLoss(991, T0 + 60, DAY, "taken", 3, 6, HUNTER)];
    w.layer.set(read(T0 + 61, [b]), T0 + 61);
    const start = T0 + 60 + ARK_ACT_HOLD_SECONDS;
    assert.equal(w.step(T0 + 62).eggs, 9, "held until the act: the eggs are still there though the record's count has dropped");
    assert.deepEqual(w.layer.pins(start - 30), [HUNTER.id], "the hunter is drawn for its act");
    assert.deepEqual(w.layer.raids(start + 1), [], "not a hunt until it is acted");
    w.step(start + 1);
    const hunter = w.entries.get(HUNTER.id)!;
    assert.equal(hunter.act?.state, "walk");
    assert.deepEqual(w.layer.raids(start + 2), [{predator: HUNTER.id, t0: start}], "WATCH ranks it as a hunt");
    const seen: number[] = [];
    for (let s = RAID_WALK - 1; s <= RAID_WALK + 6; s += 0.25) seen.push(w.step(start + s).eggs);
    assert.equal(hunter.act === null || hunter.act.state !== "eat", true);
    assert.deepEqual(Array.from(new Set(seen)), [9, 8, 7, 6], "one by one, never back up");
    assert.equal(w.step(start + RAID_WALK + 2).eggs < 9, true);
    w.step(start + RAID_WALK + 1);
    assert.equal(w.entries.get(HUNTER.id)!.act?.state, "eat");
    const giving = w.entries.get(A)!.act!;
    assert.ok(Math.hypot(giving.x - 10, giving.z - 20) > 0.5, "the parent gives way");
    // Over: the hunter its own again, the parent back on what is left.
    w.step(start + 200);
    assert.equal(w.entries.get(HUNTER.id)!.act, null);
    assert.equal(w.step(start + 201).eggs, 6);
    assert.deepEqual([w.entries.get(A)!.act!.x, w.entries.get(A)!.act!.z], [10, 20]);
    assert.deepEqual(w.layer.pins(start + 300), []);
});

test("a take read long after it happened is not replayed: the eggs are simply gone", () => {
    const w = world();
    const b = mallard({count: 6, taken: 3});
    b.losses = [rawLoss(991, T0 - 3600, DAY, "taken", 3, 6, HUNTER)];
    w.layer.set(read(T0, [b]), T0);
    w.layout();
    assert.equal(w.step(T0 + 1).eggs, 6);
    assert.deepEqual(w.layer.pins(T0 + 1), []);
});

test("young: stand-ins from the record, never more than the count, within the tier's caps; the rest instanced", () => {
    for (const tier of ["high", "medium", "low"] as const) {
        const w = world(tier);
        w.layer.set(read(T0, [mallard({stage: "young", count: 9, stage_count: 9, stage_ark_day: DAY, hold: null})]), T0);
        const roster = w.layout();
        const standIns = roster.animals.filter((a) => a.id.startsWith("brood:"));
        assert.equal(standIns.length, BROOD_MODELS[tier]);
        assert.equal(w.layer.roster(w.base), roster, "the same roster object until something changes");
        for (const s of standIns) {
            assert.equal(s.origin, "born");
            assert.equal(s.born_ark_day, DAY, "as old as its brood: drawn at young scale");
            assert.equal(s.mine, false);
            assert.deepEqual(w.layer.parentsOf(s.id), [A], "they keep to the parent the record says attends them");
            assert.equal(w.layer.parentFor(s.id), A, "a tap chooses the parent attending it");
        }
        assert.equal(w.layer.parentsOf(A), null);
        const drawn = w.step(T0 + 60);
        assert.equal(standIns.length + drawn.specks, 9, "every member is drawn once: a model or a speck");
        assert.equal(drawn.eggs, 0);
    }
    // Two members: two stand-ins, no specks.
    const w = world();
    w.layer.set(read(T0, [mallard({stage: "young", count: 2, stage_count: 2, start: 9, stage_ark_day: DAY, hold: null})]), T0);
    assert.equal(w.layout().animals.filter((a) => a.id.startsWith("brood:")).length, 2);
    assert.equal(w.step(T0 + 60).specks, 0);
    // Tadpoles are never small frogs: specks only, in proportion to what is left of 600.
    const frogs = world();
    frogs.layer.set(read(T0, [mallard({model_slug: "common-frog", name: "Common Frog", stage: "young", count: 300, start: 1200, stage_count: 600, care: "none", hold: null, carer: null, stage_ark_day: DAY})]), T0);
    assert.equal(frogs.layer.roster(frogs.base), frogs.base);
    assert.equal(frogs.step(T0 + 60).specks, 20);
});

test("the stand-ins of every brood together stay within the tier's share of the live budget", () => {
    const w = world("low");
    const many = Array.from({length: 60}, (_, i) => mallard({id: `${ID.slice(0, -3)}${String(i).padStart(3, "0")}`, stage: "young", count: 8, stage_count: 8, stage_ark_day: DAY, hold: null, nest: {slot: 90 + i, slot_rank: 0}}));
    w.layer.set(read(T0, many), T0);
    const standIns = w.layer.roster(w.base).animals.filter((a) => a.id.startsWith("brood:"));
    assert.equal(standIns.length, BROOD_MODELS_MOST.low);
    w.layout();
    assert.equal(w.step(T0 + 60).specks + standIns.length, 60 * 8, "the broods beyond the share are instanced whole");
});

test("a take of young that can run is a chase by live-meals; the others taken with it go at the catch", () => {
    const w = world();
    w.layer.set(read(T0, [mallard({stage: "young", count: 9, stage_count: 9, stage_ark_day: DAY - 1, hold: null})]), T0);
    w.layout();
    const b = mallard({stage: "young", count: 7, stage_count: 9, taken: 2, stage_ark_day: DAY - 1, hold: null});
    b.losses = [rawLoss(992, T0 + 60, DAY, "taken", 2, 7, HUNTER, {t: T0 + 60, predator: {x: 0, z: 0}, prey: {x: 10, z: 20, r: 2.5}})];
    w.layer.set(read(T0 + 61, [b]), T0 + 61);
    w.layout();
    const start = T0 + 60 + ARK_ACT_HOLD_SECONDS;
    assert.equal(w.step(start - 60).specks + 6, 9, "all nine still there before the act");
    assert.equal(w.meals.length, 0);
    w.step(start - 10);
    assert.equal(w.meals.length, 1, "handed to live-meals once, before its walk begins");
    assert.equal(w.meals[0].predator, HUNTER.id);
    assert.equal(w.meals[0].prey.startsWith("brood:"), true);
    w.step(start - 5);
    assert.equal(w.meals.length, 1);
    w.step(start + 60);
    w.layout();
    assert.equal(w.step(start + 61).specks + w.layer.roster(w.base).animals.filter((a) => a.id.startsWith("brood:")).length, 7);
});

test("a chase live-meals cannot act (a fox and ducklings on the water) becomes a raid where the brood is", () => {
    const w = world("high", false);
    w.layer.set(read(T0, [mallard({stage: "young", count: 9, stage_count: 9, stage_ark_day: DAY - 1, hold: null})]), T0);
    w.layout();
    w.entries.get(A)!.x = 40;
    const b = mallard({stage: "young", count: 7, stage_count: 9, taken: 2, stage_ark_day: DAY - 1, hold: null});
    b.losses = [rawLoss(992, T0 + 60, DAY, "taken", 2, 7, HUNTER)];
    w.layer.set(read(T0 + 61, [b]), T0 + 61);
    w.layout();
    const start = T0 + 60 + ARK_ACT_HOLD_SECONDS;
    w.step(start - 10);
    assert.equal(w.meals.length, 1);
    w.step(start + 1.5);
    assert.equal(w.dropped.length, 1, "live-meals lets it go");
    assert.deepEqual(w.layer.raids(start + 3).map((r) => r.predator), [HUNTER.id], "a hunt for WATCH all the same");
    w.step(start + 3);
    assert.equal(w.entries.get(HUNTER.id)!.act?.meal, "hunting");
    w.step(start + 1.5 + RAID_WALK + 1);
    const feeding = w.entries.get(HUNTER.id)!.act!;
    assert.equal(feeding.state, "eat");
    assert.ok(Math.hypot(feeding.x - 40, feeding.z - 20) < 2, `where the young are with their parent, not at the nest: ${feeding.x},${feeding.z}`);
    w.step(start + 120);
    w.layout();
    assert.equal(w.step(start + 121).specks + w.layer.roster(w.base).animals.filter((a) => a.id.startsWith("brood:")).length, 7, "the two are gone");
    assert.equal(w.entries.get(HUNTER.id)!.act, null);
});

test("a take of young out on the water by a hunter that cannot go there: acted at the record's place on dry ground, the taken ones come to it", () => {
    // (The pond from x 30 on; the duck and her young are out on it; the record has the take at the nest, on the bank.)
    const w = world("high", false, undefined, (x) => (x > 30 ? 0.4 : 0));
    w.layer.set(read(T0, [mallard({stage: "young", count: 9, stage_count: 9, stage_ark_day: DAY - 1, hold: null})]), T0);
    w.layout();
    w.entries.get(A)!.x = 40;
    for (let i = 0; i < 6; i++) w.entries.get(arkBroodMemberId(ID, i))!.x = 41 + i * 0.3;
    w.step(T0 + 30);
    const b = mallard({stage: "young", count: 7, stage_count: 9, taken: 2, stage_ark_day: DAY - 1, hold: null});
    b.losses = [rawLoss(993, T0 + 60, DAY, "taken", 2, 7, HUNTER, {t: T0 + 60, predator: {x: 0, z: 20}, prey: {x: 10, z: 20, r: 2.5}})];
    w.layer.set(read(T0 + 61, [b]), T0 + 61);
    w.layout();
    const start = T0 + 60 + ARK_ACT_HOLD_SECONDS;
    w.step(start - 10);
    w.step(start + 1.5);
    assert.equal(w.dropped.length, 1, "no chase onto the water");
    w.step(start + 3);
    const coming = w.entries.get(arkBroodMemberId(ID, 5))!.act!;
    assert.ok(coming && !coming.hidden && coming.x < 47, "the last stand-in leaves the brood for the take's place");
    w.step(start + 1.5 + RAID_WALK + 0.5);
    const feeding = w.entries.get(HUNTER.id)!.act!;
    assert.equal(feeding.state, "eat");
    assert.ok(Math.hypot(feeding.x - 10, feeding.z - 20) < 2, `at the record's place on the bank, never on the pond: ${feeding.x},${feeding.z}`);
    for (const i of [4, 5]) {
        const member = w.entries.get(arkBroodMemberId(ID, i))!.act!;
        assert.ok(Math.hypot(member.x - 10, member.z - 20) < 1.5 && member.state !== "swim", `the taken one is at the take: ${member.x},${member.z}`);
    }
    assert.equal(w.entries.get(arkBroodMemberId(ID, 0))!.act, null, "the others stay with their parent");
    // (Two members: four seconds of feeding; the first is gone halfway.)
    w.step(start + 1.5 + RAID_WALK + 2.5);
    assert.equal(w.entries.get(arkBroodMemberId(ID, 5))!.act!.hidden, true, "taken one by one as it feeds");
    assert.equal(w.entries.get(arkBroodMemberId(ID, 4))!.act!.hidden, false);
    w.step(start + 120);
    w.layout();
    assert.equal(w.step(start + 121).specks + w.layer.roster(w.base).animals.filter((a) => a.id.startsWith("brood:")).length, 7, "seven left");
});

test("losses with no cause: the members fade where they are; no hunter, no act, no pin", () => {
    const w = world();
    w.layer.set(read(T0, [mallard({stage: "young", count: 4, stage_count: 4, stage_ark_day: DAY - 1, hold: null})]), T0);
    w.layout();
    w.step(T0 + 30);
    const b = mallard({stage: "young", count: 2, stage_count: 4, lost: 2, stage_ark_day: DAY - 1, hold: null});
    b.losses = [rawLoss(993, T0 + 60, DAY, "did_not_survive", 2, 2)];
    w.layer.set(read(T0 + 61, [b]), T0 + 61);
    w.layout();
    assert.deepEqual(w.layer.pins(T0 + 62), []);
    w.step(T0 + 63);
    const fading = [2, 3].map((i) => w.entries.get(arkBroodMemberId(ID, i))!.act);
    assert.ok(fading.every((act) => act && act.scale < 1 && act.state === "rest"), "they fade in place");
    for (const act of fading) assert.equal(act!.lying, undefined, "no death act: nothing lies down");
    assert.equal(w.entries.get(arkBroodMemberId(ID, 0))!.act, null, "the survivors are untouched");
    w.step(T0 + 70);
    assert.equal(w.layout().animals.filter((a) => a.id.startsWith("brood:")).length, 2);
    assert.equal(w.meals.length, 0);
});

test("a failed nest stands empty, then fades; no eggs, no parent held on it", () => {
    const w = world();
    w.layer.set(read(T0, [mallard()]), T0);
    w.layout();
    w.step(T0 + 5);
    const gone = mallard({count: 0, lost: 9, outcome: "failed", ended_ark_day: DAY});
    gone.losses = [rawLoss(994, T0 + 60, DAY, "failed", 9, 0)];
    w.layer.set(read(T0 + 61, [], [gone]), T0 + 61);
    const soon = w.step(T0 + 120);
    assert.deepEqual({nests: soon.nests, eggs: soon.eggs}, {nests: 1, eggs: 0});
    assert.equal(w.entries.get(A)!.act, null, "the parent goes back to its day");
    assert.equal(w.step(T0 + 61 + 500).nests, 1, "still standing minutes later");
    assert.equal(w.step(T0 + 61 + 700).nests, 0, "then gone");
});

test("recruitment: no birth; each new animal takes over from a stand-in where it stood", () => {
    const w = world();
    w.layer.set(read(T0, [mallard({stage: "young", count: 3, stage_count: 3, stage_ark_day: DAY - 20, hold: null})]), T0);
    w.layout();
    w.step(T0 + 30);
    for (let i = 0; i < 3; i++) w.entries.get(arkBroodMemberId(ID, i))!.x = 30 + i;
    w.step(T0 + 31);
    const done = mallard({stage: "young", count: 3, stage_count: 3, stage_ark_day: DAY - 20, hold: null, outcome: "independent", ended_ark_day: DAY});
    w.layer.set(read(T0 + 60, [], [done]), T0 + 60);
    assert.equal(w.layout().animals.filter((a) => a.id.startsWith("brood:")).length, 3, "the stand-ins wait for their recruits");
    const recruits = ["r-1", "r-2"];
    w.layer.recruited(ID, recruits);
    for (const id of recruits) w.add(id, 50, 50);
    w.step(T0 + 61);
    const first = w.entries.get("r-1")!.act!;
    assert.ok(Math.abs(first.x - 30) < 1.5 && first.scale === 1 && !first.hidden, "where its stand-in stood, whole: not born again");
    assert.notEqual(first.meal, "birthing");
    assert.equal(w.layer.roster(w.base).animals.filter((a) => a.id.startsWith("brood:")).length, 1, "a stand-in goes as its recruit takes over");
    w.step(T0 + 70);
    assert.equal(w.entries.get("r-1")!.act, null, "then its own");
});

// MARK: The log

const TEXT = {live: {}, replay: {a: "a {animal}", an: "an {animal}"}} as unknown as ArkLiveText;
const row = (id: number, kind: string, extra: Record<string, unknown>) => ({id, kind, at: new Date((T0 + id) * 1000).toISOString(), ark_day: DAY, ...extra});
const duck = {id: A, name: "Mallard", species_profile_id: "sp-mallard", model_slug: "mallard", zone: "wetland"};
const heron = {id: HUNTER.id, name: "Grey Heron", species_profile_id: "sp-heron", model_slug: "grey-heron", zone: "wetland"};

test("the log's brood lines: hatched, taken, held off, failed, recruited; census rows and other rows say nothing", () => {
    const rows = [
        row(1, "laid", {animal: duck, parents: [A, B], brood: {id: ID}, clutch: {eggs: 9, hatch_ark_day: DAY + 20}}),
        row(2, "meal", {animal: heron, other: null, brood: {id: ID, taken: 2, left: 7, stage: "egg", egg: true}, prey: {species_profile_id: "sp-mallard", name: "Mallard", model_slug: "mallard"}}),
        row(3, "escaped", {animal: null, other: heron, brood: {id: ID, defended: true, guard: A}, prey: {species_profile_id: "sp-mallard", name: "Mallard", model_slug: "mallard"}}),
        row(4, "brood_stage", {animal: duck, brood: {id: ID, from: "egg", count: 7, of: 9}}),
        row(5, "meal", {animal: heron, other: null, brood: {id: ID, taken: 14, left: 586, stage: "young"}, prey: {species_profile_id: "sp-frog", name: "Common Frog", model_slug: "common-frog"}}),
        row(6, "brood_loss", {animal: duck, brood: {id: ID, cause: "did_not_survive", count: 1, left: 6}}),
        row(7, "brood_loss", {animal: duck, brood: {id: ID, cause: "failed", count: 6, left: 0, stage: "egg"}}),
        row(8, "birth", {animal: {...duck, id: "r-1"}, parents: [A, B], recruit: true, brood: {id: ID, survivors: 3, of: 9}}),
        row(9, "birth", {animal: {...duck, id: "r-2"}, parents: [A, B], recruit: true, brood: {id: ID, survivors: 3, of: 9}}),
        row(10, "brood_loss", {animal: duck, brood: {id: ID, cause: "unsettled", count: 2, left: 0}}),
        row(11, "meal", {animal: heron, other: duck}),
        row(12, "birth", {animal: {...duck, id: "c-1"}, parents: [A, B]})
    ];
    assert.deepEqual(rows.map(isBroodRow), [true, true, true, true, true, true, true, true, true, true, false, false]);
    const {items, touched} = broodItems(rows, -Infinity, () => false, {words: null, text: TEXT, locale: "en", brood: () => null});
    assert.equal(touched, true);
    assert.deepEqual(items.map((item) => broodText(item)), [
        "Mallard: 2 eggs taken by a Grey Heron · 7 left",
        "Mallard: the parent drove off a Grey Heron",
        "Mallard: 7 eggs hatched",
        "Common Frog: 14 young taken by a Grey Heron · 586 left",
        "Mallard: the nest failed",
        "Mallard: 2 young now on their own",
        "Mallard: 2 young did not settle"
    ]);
    assert.equal(items[0].focus.animalId, HUNTER.id, "a take's tap goes to the hunter");
    assert.equal(items[1].focus.animalId, A, "a held-off raid's tap goes to the parent that stood");
    assert.deepEqual(Array.from(broodRecruitIds(rows)), ["8", "9"], "a recruit's birth is never said or acted as a birth");
    assert.deepEqual(broodRecruits(rows, -Infinity), [{brood: ID, young: ["r-1", "r-2"], parents: [A, B]}]);
    // Said once; nothing older than the cursor; a read with no brood row touches nothing.
    assert.equal(broodItems(rows, -Infinity, () => true, {words: null, text: TEXT, locale: "en", brood: () => null}).items.length, 0);
    assert.equal(broodItems(rows, (T0 + 100) * 1000, () => false, {words: null, text: TEXT, locale: "en", brood: () => null}).items.length, 0);
    assert.equal(broodItems([rows[10], rows[11]], -Infinity, () => false, {words: null, text: TEXT, locale: "en", brood: () => null}).touched, false);
    assert.equal(broodText({key: "meal:x", line: "something"}), null);
    for (const item of items) assert.doesNotMatch(item.line ?? "", /@|brought|user/i, "species only");
});

test("7.2 as of BROODS 3feb455cf: a brood's mated and laid stay the pair's; an escape with a guard and no animal; a carer-lost recruit; a stage past the young says nothing", () => {
    const rows = [
        row(1, "mated", {animal: duck, parents: [A, B], brood: {id: ID}}),
        // (The laying parent is now the row's `animal`, not an egg row: every reader takes its name, kind and parents.)
        row(2, "laid", {animal: duck, parents: [A, B], brood: {id: ID}, clutch: {eggs: 9, hatch_ark_day: DAY + 20}}),
        row(3, "escaped", {other: heron, brood: {id: ID, taken: 0, left: 9, stage: "egg", defended: true, guard: B}, prey: {species_profile_id: "sp-mallard", name: "Mallard", model_slug: "mallard"}}),
        row(4, "meal", {animal: heron, other: null, brood: {id: ID, taken: 2, left: 7, stage: "young"}, prey: {species_profile_id: "sp-mallard", name: "Mallard", model_slug: "mallard"}}),
        row(5, "brood_loss", {animal: duck, brood: {id: ID, cause: "parent_lost", count: 0, left: 7, of: 9, unguarded: true}}),
        row(6, "birth", {animal: {...duck, id: "r-1"}, parents: [A, B], recruit: true, carerLost: true, brood: {id: ID, survivors: 1, of: 9}}),
        row(7, "brood_stage", {animal: duck, brood: {id: ID, from: "young", count: 3, of: 9}})
    ];
    // Which the brood layer acts (the seen layers leave these alone): the take, the drive-off, the recruit. Not the mating or the laying.
    assert.deepEqual(rows.map(isBroodActedRow), [false, false, true, true, false, true, false]);
    const {items} = broodItems(rows, -Infinity, () => false, {words: null, text: TEXT, locale: "en", brood: () => null});
    assert.deepEqual(items.map((item) => broodText(item)), [
        "Mallard: the parent drove off a Grey Heron",
        "Mallard: 2 young taken by a Grey Heron · 7 left",
        "Mallard: the brood goes on without a parent",
        "Mallard: 1 young now on their own"
    ], "the mated and laid rows are the log's own lines; a brood that carries on unguarded was not lost: it goes on without a parent; a stage change past the young says nothing yet");
    // (Unguarded with none of it left: nothing goes on, nothing is said.)
    const none = broodItems([row(9, "brood_loss", {animal: duck, brood: {id: ID, cause: "parent_lost", count: 0, left: 0, of: 9, unguarded: true}})], -Infinity, () => false, {words: null, text: TEXT, locale: "en", brood: () => null}).items;
    assert.deepEqual(none, []);
    // (A brood lost with its parent is still said so.)
    const lost = broodItems([row(8, "brood_loss", {animal: duck, brood: {id: ID, cause: "parent_lost", count: 7, left: 0, of: 9}})], -Infinity, () => false, {words: null, text: TEXT, locale: "en", brood: () => null}).items;
    assert.deepEqual(lost.map((item) => broodText(item)), ["Mallard: the brood was lost with its parent"]);
    assert.equal(items[0].focus.animalId, B, "the drive-off's tap goes to the row's guard");
    assert.deepEqual(broodRecruits(rows, -Infinity), [{brood: ID, young: ["r-1"], parents: [A, B]}], "a recruit whose carers were lost is handed over as any other");
    // A live brood at a stage this client does not know is not drawn (and nothing throws); the others are.
    const later = decodeArkBroods(rawBroodsRead(T0, DAY, [mallard({id: "b100d000-0000-4000-8000-0000000000f1", stage: "floater" as never}), mallard()]));
    assert.deepEqual(later.broods.map((b) => b.id), [ID]);
});

test("every Ark locale has the broods' words, each with its placeholders", () => {
    const root = path.join(process.cwd(), "src/data/locales");
    const files = [path.join(root, "en.json"), path.join(root, "id.json"), ...readdirSync(path.join(root, "ark")).filter((name) => name.endsWith(".json")).map((name) => path.join(root, "ark", name))];
    assert.equal(files.length, 45);
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const file of files) {
        const words = (JSON.parse(readFileSync(file, "utf8")) as {ark?: {broods?: Record<string, string>}}).ark?.broods;
        assert.ok(words, `${path.basename(file)} has ark.broods`);
        for (const [key, english] of Object.entries(ARK_BROOD_ENGLISH)) {
            assert.equal(typeof words[key], "string", `${path.basename(file)} ${key}`);
            assert.ok(words[key].trim().length > 0, `${path.basename(file)} ${key}`);
            assert.equal(holes(words[key]), holes(english), `${path.basename(file)} ${key}: ${words[key]}`);
        }
        assert.deepEqual(Object.keys(words).sort(), Object.keys(ARK_BROOD_ENGLISH).sort(), path.basename(file));
    }
    assert.deepEqual((JSON.parse(readFileSync(files[0], "utf8")) as {ark: {broods: unknown}}).ark.broods, ARK_BROOD_ENGLISH, "en.json is the English");
});
