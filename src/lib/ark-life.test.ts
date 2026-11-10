import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {chaseKind} from "@/ark-scene/acts";
import serverCapture from "@/ark-scene/fixtures/server-capture.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import fixtureEvents from "@/ark-scene/fixtures/events.json";
import fixtureLives from "@/ark-scene/fixtures/lives.json";
import {arkCaptureProblems, decodeArkCapture, type ArkCapture} from "@/lib/ark-capture";
import {daylightAt, isAwake, sunElevation} from "@/lib/ark-daylight";
import {
    arkJoinLabels,
    arkSinceWhen,
    decodeArkEvents,
    decodeArkLife,
    isQuietArkReplay,
    planArkReplay,
    readArkLastVisit,
    writeArkLastVisit,
    ARK_LAST_VISIT_KEY
} from "@/lib/ark-life";

function animal(id: string, slug: string, zone: ArkAnimal["zone"], arrived: string, extra: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id, species_profile_id: `sp-${slug}`, name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), scientific_name: null, model_slug: slug, zone, arrived_at: arrived, brought_by: {label: "Voyager 1", named: false}, mine: false, ...extra};
}

const SNAPSHOT: ArkSnapshot = {
    voyage: {slug: "first", name: "The first Ark", started_at: null},
    counts: {animals: 2, species: 2, founders: 1},
    zones: [],
    animals: [animal("lion-1", "african-lion", "grassland", "2026-11-01T00:00:00Z"), animal("zebra-1", "plains-zebra", "grassland", "2026-11-02T00:00:00Z")],
    as_of: null
};

/** One public animal as the server sends it in an event (`voyage_event_animal`). */
function sent(id: string, slug: string, zone: string, extra: Record<string, unknown> = {}) {
    return {id, species_profile_id: `sp-${slug}`, name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", origin: "arrived", generation: 0, slot: 0, slot_rank: 0, activity: "diurnal", sociality: null, status: "present", ...extra};
}

function row(id: number, kind: string, at: string, extra: Record<string, unknown> = {}) {
    return {id, kind, at, ark_day: 40, species_profile_id: null, species: null, animal: null, other: null, phrase: null, parents: [], bringers: [], ...extra};
}

test("events: the server's rows decode whole (an animal no longer aboard included), junk is dropped, oldest first", () => {
    const events = decodeArkEvents({events: [
        row(10, "meal", "2026-11-09T10:00:00.000000Z", {animal: sent("lion-1", "african-lion", "grassland"), other: sent("zebra-9", "plains-zebra", "grassland", {slot: 3, slot_rank: 1, status: "eaten", sociality: "group"}), phrase: "zebras", species: "African Lion"}),
        row(9, "arrival", "2026-11-09T09:00:00.000000Z", {animal: sent("zebra-1", "plains-zebra", "grassland")}),
        row(11, "teleport", "2026-11-09T09:00:00Z"),
        row(12, "birth", "not a time"),
        "nonsense"
    ], next_since: "2026-11-09T10:00:00.000000Z", more: false, as_of: "2026-11-10T00:00:00Z"}, SNAPSHOT);
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((e) => e.id), ["9", "10"]);
    assert.equal(events[0].animal?.model_slug, "plains-zebra");
    const meal = events[1];
    assert.equal(meal.animal?.name, "African Lion");
    assert.equal(meal.species?.name, "African Lion");
    assert.deepEqual([meal.other?.id, meal.other?.slot, meal.other?.slot_rank, meal.other?.status, meal.other?.sociality], ["zebra-9", 3, 1, "eaten", "group"]);
    assert.equal(meal.phrase, "zebras");
    // A species with no model yet: drawn as the snapshot has it, else as the placeholder.
    const unmodelled = decodeArkEvents([row(1, "arrival", "2026-11-09T09:00:00Z", {animal: {...sent("lion-1", "african-lion", "grassland"), model_slug: null}})], SNAPSHOT);
    assert.equal(unmodelled[0].animal?.model_slug, "african-lion");
    // A species with no Ark model (A13): the placeholder's slug, as the snapshot decodes it, never dropped.
    assert.equal(decodeArkEvents([row(1, "arrival", "2026-11-09T09:00:00Z", {animal: {...sent("x", "x", "grassland"), model_slug: null}})], null)[0].animal?.model_slug, "placeholder--sp-x");
});

test("replay: a meal and its eaten row are one act, a litter is one act, an extinction rides on its cause, starvation is a quiet death", () => {
    const prey = sent("m1", "alpine-marmot", "mountains", {status: "eaten"});
    const eagle = sent("e1", "golden-eagle", "mountains");
    const events = decodeArkEvents([
        row(1, "birth", "2026-11-08T19:30:00Z", {animal: sent("f1", "plains-zebra", "grassland", {origin: "born", generation: 1}), parents: ["z1", "z2"], bringers: [{label: "Voyager 2", named: false}, {label: "Voyager 5", named: false}]}),
        row(2, "birth", "2026-11-08T19:30:00Z", {animal: sent("f2", "plains-zebra", "grassland", {origin: "born", generation: 1}), parents: ["z2", "z1"], bringers: [{label: "Voyager 2", named: false}, {label: "Voyager 5", named: false}]}),
        row(3, "meal", "2026-11-09T09:15:00Z", {animal: eagle, other: prey, phrase: "marmots"}),
        row(4, "eaten", "2026-11-09T09:15:00Z", {animal: prey, other: eagle, phrase: "marmots"}),
        row(5, "extinction", "2026-11-09T09:15:00Z", {species_profile_id: "sp-alpine-marmot", species: "Alpine Marmot"}),
        row(6, "hungry", "2026-11-09T10:00:00Z", {animal: eagle}),
        row(7, "milestone", "2026-11-09T11:00:00Z", {animal: eagle}),
        row(8, "starved", "2026-11-09T12:00:00Z", {animal: {...eagle, status: "starved"}})
    ], null);
    const plan = planArkReplay(events);
    assert.deepEqual(plan.acts.map((act) => act.kind), ["birth", "meal", "death"]);
    const birth = plan.acts[0];
    assert.ok(birth.kind === "birth" && birth.young.length === 2);
    assert.deepEqual(birth.kind === "birth" ? birth.bringers : [], ["Voyager 2", "Voyager 5"]);
    const meal = plan.acts[1];
    assert.ok(meal.kind === "meal" && meal.extinct && meal.phrase === "marmots");
    const starved = plan.acts[2];
    assert.ok(starved.kind === "death" && starved.cause === "starved" && starved.animal.status === "starved");
    assert.deepEqual(plan.summary, {arrivals: 0, births: 2, meals: 1, deaths: 0, starved: 1, extinctions: 1, laid: 0, hatched: 0});
    assert.equal(isQuietArkReplay(plan.summary), false);
});

test("replay: capped, keeping the rarest and the newest arrival, still in order", () => {
    const rows: unknown[] = [];
    for (let i = 0; i < 12; i++) rows.push(row(i + 1, "arrival", `2026-11-09T${String(i + 10).padStart(2, "0")}:00:00Z`, {animal: sent(`a${i}`, "mallard", "river_lake")}));
    rows.push(row(20, "death_old", "2026-11-09T09:00:00Z", {animal: sent("s1", "house-sparrow", "farm_garden", {status: "died_old"})}));
    const plan = planArkReplay(decodeArkEvents(rows, null), 3);
    assert.equal(plan.acts.length, 3);
    assert.equal(plan.acts[0].kind, "death");
    assert.ok(plan.acts.some((act) => act.kind === "arrival" && act.animal.id === "a11"));
    assert.equal(plan.summary.arrivals, 12);
    assert.deepEqual(plan.acts.map((act) => act.at), [...plan.acts.map((act) => act.at)].sort());
});

test("life: the server's answer decodes whole; the public story only when it sends one; labels only", () => {
    const voyager = (n: number) => ({label: `Voyager ${n}`, named: false});
    const arrived = decodeArkLife({id: "a1", species_profile_id: "sp", species: "Jaguar", model_slug: "jaguar", status: "present", origin: {kind: "arrived", at: "2026-11-01T00:00:00Z", brought_by: voyager(7)}, generation: 0, born_ark_day: 10, ark_age_days: 100, ark_age_years: 0.27, condition: "hungry", meals: 2, last_meal: {at: "2026-11-02T00:00:00Z", ark_day: 12, prey: "House Sparrow", prey_species_profile_id: "sp2", phrase: "birds"}, young_raised: 1, ancestor_brought_by: voyager(7), milestones: {count: 3, latest_at: "2026-11-05T00:00:00Z"}, died: null, story_public: null});
    assert.ok(arrived && arrived.origin.kind === "arrived");
    assert.equal(arrived.origin.brought_by, "Voyager 7");
    assert.equal(arrived.story_public, null);
    assert.equal(arrived.last_meal?.phrase, "birds");
    assert.deepEqual(arrived.milestones, {count: 3, latest_at: "2026-11-05T00:00:00Z"});
    assert.equal(arrived.condition, "hungry");
    assert.equal(arrived.ancestor_brought_by, "Voyager 7");
    const born = decodeArkLife({id: "a2", status: "starved", origin: {kind: "born", at: "2026-11-08T00:00:00Z", parents: ["p1", "p2"], born_to: [voyager(2), voyager(5)], breeding_source: "estimate"}, generation: 1, condition: null, died: {at: "2026-11-09T00:00:00Z", kind: "starved"}, milestones: {count: 0, latest_at: null}, story_public: {kind: "public_debate", problem: "Mornings", way: {animal: "Bee", power: "One Flower"}, debate_id: null}});
    assert.ok(born && born.origin.kind === "born");
    assert.deepEqual(born.origin.kind === "born" ? [born.origin.born_to, born.origin.breeding_source] : [], [["Voyager 2", "Voyager 5"], "estimate"]);
    assert.equal(born.status, "starved");
    assert.deepEqual(born.died, {at: "2026-11-09T00:00:00Z", kind: "starved"});
    assert.equal(born.condition, null);
    assert.equal(born.story_public?.problem, "Mornings");
    // A private-looking shape never comes through as a story.
    assert.equal(decodeArkLife({id: "a3", story_public: {kind: "private_chat", problem: "secret"}})?.story_public, null);
    assert.equal(decodeArkLife(null), null);
    assert.equal(arkJoinLabels(["Voyager 2", "Voyager 5"], "en"), "Voyager 2 and Voyager 5");
});

test("the server's own answers (the rolled-back production rehearsal's capture) are read whole", () => {
    const capture = serverCapture as unknown as ArkCapture;
    assert.deepEqual(arkCaptureProblems(capture), []);
    const decoded = decodeArkCapture(capture);
    assert.deepEqual(decoded.lost, []);
    // The meal and its eaten row are one act; the eaten hawk (no longer aboard) is drawn from the event, where it stood.
    const meal = decoded.plan.acts.find((act) => act.kind === "meal");
    assert.ok(meal && meal.kind === "meal" && meal.prey.status === "eaten" && meal.prey.slot !== null && meal.phrase === "birds" && meal.extinct);
    assert.equal(decoded.plan.acts.filter((act) => act.kind === "meal").length, 1);
    const starved = decoded.plan.acts.find((act) => act.kind === "death");
    assert.ok(starved && starved.kind === "death" && starved.cause === "starved");
    const young = Array.from(decoded.lives.values()).find((life) => life?.origin.kind === "born");
    assert.ok(young && young.status === "starved" && young.died?.kind === "starved");
    assert.ok(young.origin.kind === "born" && young.origin.breeding_source === "estimate" && young.origin.born_to.every((label) => /^Voyager \d+$/.test(label)));
    // No id of a person anywhere: every label is "Voyager N" (nobody here chose to be named).
    assert.ok(!/user_id|owner|bringer_ids|step|debate_id/.test(JSON.stringify(capture)));
});

test("the development fixtures are the server's shapes exactly, and read whole", () => {
    const capture = {snapshot: fixtureV2, events: fixtureEvents, lives: fixtureLives} as unknown as ArkCapture;
    assert.deepEqual(arkCaptureProblems(capture), []);
    assert.deepEqual(decodeArkCapture(capture).lost, []);
});

test("last visit: storage that throws means a first visit, never an error", () => {
    const broken = {getItem: () => {
        throw new Error("blocked");
    }, setItem: () => {
        throw new Error("blocked");
    }};
    assert.equal(readArkLastVisit(broken), null);
    assert.doesNotThrow(() => writeArkLastVisit(broken, new Date()));
    const kept = new Map<string, string>();
    const store = {getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value)};
    writeArkLastVisit(store, new Date("2026-11-03T10:00:00Z"));
    assert.equal(kept.get(ARK_LAST_VISIT_KEY), "2026-11-03T10:00:00.000Z");
    assert.equal(readArkLastVisit(store), "2026-11-03T10:00:00.000Z");
});

test("since when: today, yesterday, a weekday, a date", () => {
    const words = {today: "earlier today", yesterday: "yesterday", weekday: "{day}", date: "{date}"};
    const now = new Date(2026, 10, 12, 18);
    assert.equal(arkSinceWhen(new Date(2026, 10, 12, 8), now, "en", words), "earlier today");
    assert.equal(arkSinceWhen(new Date(2026, 10, 11, 8), now, "en", words), "yesterday");
    assert.equal(arkSinceWhen(new Date(2026, 10, 10, 8), now, "en", words), "Tuesday");
    assert.equal(arkSinceWhen(new Date(2026, 10, 1, 8), now, "en-GB", words), "1 November");
});

test("daylight: 17:00 is the v1 golden hour; night is the moon's; who sleeps", () => {
    const golden = daylightAt(17);
    assert.equal(golden.light.color, "#ffd9a8");
    assert.equal(golden.fog, "#d9c9b4");
    assert.equal(golden.phase, "day");
    assert.ok(Math.abs(golden.azimuth - -117) < 1);
    const night = daylightAt(23.5);
    assert.equal(night.phase, "night");
    assert.ok(night.night > 0.9 && night.light.elevation > 20);
    assert.equal(daylightAt(6.2).phase, "dawn");
    assert.equal(daylightAt(18.2).phase, "dusk");
    const noon = sunElevation(12);
    const midnight = sunElevation(0);
    assert.equal(isAwake("diurnal", noon), true);
    assert.equal(isAwake("diurnal", midnight), false);
    assert.equal(isAwake(null, midnight), false);
    assert.equal(isAwake("nocturnal", noon), false);
    assert.equal(isAwake("nocturnal", midnight), true);
    assert.equal(isAwake("crepuscular", sunElevation(18.5)), true);
    assert.equal(isAwake("crepuscular", noon), false);
    assert.equal(isAwake("any", noon) && isAwake("any", midnight), true);
});

test("snapshot: v2 fields decode when present and stay absent from a v1 answer", () => {
    const v1 = decodeArkSnapshot({voyage: {slug: "first"}, animals: [{id: "a", model_slug: "mallard", name: "Mallard", arrived_at: "2026-11-01T00:00:00Z", zone: "river_lake"}]});
    assert.equal(v1?.animals[0].origin, undefined);
    assert.equal(v1?.animals[0].slot, undefined);
    assert.equal(v1?.ark_day, undefined);
    const v2 = decodeArkSnapshot({voyage: {slug: "first", ark_day: 286.5}, animals: [{id: "b", model_slug: "plains-zebra", name: "Plains Zebra", arrived_at: "2026-11-08T19:30:00Z", zone: "grassland", brought_by: null, origin: "born", generation: 1, condition: "hungry", born_ark_day: 270.1, activity: "diurnal", sociality: "group", bringers: [{label: "Voyager 2", named: false}, {label: "Voyager 5", named: false}], slot: 4, slot_rank: 2}]});
    const born = v2?.animals[0];
    assert.equal(v2?.ark_day, 286.5);
    assert.equal(born?.origin, "born");
    assert.equal(born?.arrived_at, "2026-11-08T19:30:00Z");
    assert.deepEqual([born?.slot, born?.slot_rank], [4, 2]);
    assert.equal(born?.sociality, "group");
    assert.equal(born?.bringers?.length, 2);
});

test("placement: from the server's places alone, so nobody moves when another leaves; a cluster stands together", () => {
    const zebra = (i: number, slot: number, rank: number) => animal(`z${i}`, "plains-zebra", "grassland", `2026-11-0${i + 1}T00:00:00Z`, {sociality: "group", slot, slot_rank: rank});
    const herd = Array.from({length: 6}, (_, i) => zebra(i, 1, i));
    const loners = Array.from({length: 6}, (_, i) => animal(`c${i}`, "cheetah", "grassland", `2026-11-0${i + 1}T01:00:00Z`, {sociality: "solitary", slot: [0, 2, 3, 4, 5, 6][i], slot_rank: 0}));
    const all = [...herd, ...loners];
    const placed = placeAnimals(all);
    const again = placeAnimals([...all].reverse());
    for (const a of all) assert.deepEqual(placed.get(a.id), again.get(a.id));
    const spread = (ids: string[]) => {
        const points = ids.map((id) => placed.get(id)!);
        let most = 0;
        for (const a of points) for (const b of points) most = Math.max(most, Math.hypot(a.x - b.x, a.z - b.z));
        return most;
    };
    assert.ok(spread(herd.map((a) => a.id)) < spread(loners.map((a) => a.id)), "the herd is tighter than the loners");
    assert.equal(placed.get("z3")?.leader, "z0");
    // The herd's first one and a loner of an earlier slot leave: everyone else stands exactly where they stood.
    const after = placeAnimals(all.filter((a) => a.id !== "z0" && a.id !== "c0"));
    after.forEach((place, id) => {
        const before = placed.get(id)!;
        assert.deepEqual([place.x, place.z, place.yaw], [before.x, before.z, before.yaw], id);
    });
    assert.equal(after.get("z3")?.leader, "z1");
    // A v1 answer (no places): given by the server's rules in arrival order; a group species gathers.
    const v1 = placeAnimals(all.map(({slot: _s, slot_rank: _r, ...rest}) => rest));
    assert.equal(v1.get("z3")?.leader, "z0");
});

test("chases: each kind for the animals it suits, a cut-away where a glide would look wrong", () => {
    const kind = (predatorSlug: string, plan: string | null, predatorWater = false, preyWater = false, flies = false) => chaseKind({predatorSlug, predatorPlan: plan, predatorWater, preyWater, predatorFlies: flies});
    assert.equal(kind("african-lion", "mammal"), "glide");
    assert.equal(kind("american-bullfrog", "frog"), "bound");
    assert.equal(kind("african-rock-python", "snake"), "slither");
    assert.equal(kind("bluefin-tuna", "fish", true, true), "dart");
    assert.equal(kind("golden-eagle", "bird", false, false, true), "swoop");
    assert.equal(kind("grey-heron", "bird", true, true), "swoop");
    assert.equal(kind("great-white-shark", "fish", true, false), "cutaway");
    assert.equal(kind("emperor-penguin", "bird", false, true), "cutaway");
    assert.equal(kind("monarch-butterfly", "butterfly"), "cutaway");
    assert.equal(kind("polar-bear", "mammal", false, true), "cutaway");
});
