import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {chaseKind} from "@/ark-scene/acts";
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

test("events: nested and flat rows decode, details come from the snapshot, junk is dropped", () => {
    const events = decodeArkEvents([
        {id: 3, kind: "meal", at: "2026-11-09T10:00:00Z", animal_id: "lion-1", other_animal_id: "zebra-9", other_name: "Plains Zebra", other_model_slug: "plains-zebra", other_zone: "grassland", payload: {phrase: "zebras"}},
        {kind: "arrival", at: "2026-11-09T09:00:00Z", animal: {id: "zebra-1"}},
        {kind: "teleport", at: "2026-11-09T09:00:00Z"},
        {kind: "birth", at: "not a time"},
        "nonsense"
    ], SNAPSHOT);
    assert.equal(events.length, 2);
    assert.equal(events[0].kind, "arrival");
    assert.equal(events[0].animal?.model_slug, "plains-zebra");
    assert.equal(events[1].animal?.name, "African Lion");
    assert.equal(events[1].other?.id, "zebra-9");
    assert.equal(events[1].phrase, "zebras");
});

test("replay: a meal and its eaten row are one act, a litter is one act, an extinction rides on its cause", () => {
    const prey = {id: "m1", species_profile_id: "sp-marmot", name: "Alpine Marmot", model_slug: "alpine-marmot", zone: "mountains"};
    const eagle = {id: "e1", species_profile_id: "sp-eagle", name: "Golden Eagle", model_slug: "golden-eagle", zone: "mountains"};
    const events = decodeArkEvents([
        {kind: "birth", at: "2026-11-08T19:30:00Z", animal: {id: "f1", name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland"}, parents: ["z1", "z2"], bringers: ["Voyager 2", "Voyager 5"]},
        {kind: "birth", at: "2026-11-08T19:30:00Z", animal: {id: "f2", name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland"}, parents: ["z2", "z1"], bringers: ["Voyager 2", "Voyager 5"]},
        {kind: "meal", at: "2026-11-09T09:15:00Z", animal: eagle, other: prey, phrase: "marmots"},
        {kind: "eaten", at: "2026-11-09T09:15:00Z", animal: prey, other: eagle},
        {kind: "extinction", at: "2026-11-09T09:15:00Z", species_profile_id: "sp-marmot", species_name: "Alpine Marmot"},
        {kind: "hungry", at: "2026-11-09T10:00:00Z", animal: eagle},
        {kind: "milestone", at: "2026-11-09T11:00:00Z", animal: eagle}
    ], null);
    const plan = planArkReplay(events);
    assert.deepEqual(plan.acts.map((act) => act.kind), ["birth", "meal"]);
    const birth = plan.acts[0];
    assert.ok(birth.kind === "birth" && birth.young.length === 2);
    const meal = plan.acts[1];
    assert.ok(meal.kind === "meal" && meal.extinct && meal.phrase === "marmots");
    assert.deepEqual(plan.summary, {arrivals: 0, births: 2, meals: 1, deaths: 0, extinctions: 1});
    assert.equal(isQuietArkReplay(plan.summary), false);
});

test("replay: capped, keeping the rarest and the newest arrival, still in order", () => {
    const rows = [];
    for (let i = 0; i < 12; i++) rows.push({kind: "arrival", at: `2026-11-09T${String(i + 10).padStart(2, "0")}:00:00Z`, animal: {id: `a${i}`, name: "Mallard", model_slug: "mallard", zone: "river_lake"}});
    rows.push({kind: "death_old", at: "2026-11-09T09:00:00Z", animal: {id: "s1", name: "House Sparrow", model_slug: "house-sparrow", zone: "farm_garden"}});
    const plan = planArkReplay(decodeArkEvents(rows, null), 3);
    assert.equal(plan.acts.length, 3);
    assert.equal(plan.acts[0].kind, "death");
    assert.ok(plan.acts.some((act) => act.kind === "arrival" && act.animal.id === "a11"));
    assert.equal(plan.summary.arrivals, 12);
    assert.deepEqual(plan.acts.map((act) => act.at), [...plan.acts.map((act) => act.at)].sort());
});

test("life: the public story only when the server sends it, labels only, safe defaults", () => {
    const arrived = decodeArkLife({id: "a1", status: "present", origin: {kind: "arrived", at: "2026-11-01T00:00:00Z", brought_by: "Voyager 7"}, generation: 0, ark_age_days: 100, meals: 2, last_meal: {prey: "House Sparrow", phrase: "birds"}, young_raised: 1, milestones: {count: 3}, story_public: null});
    assert.ok(arrived);
    assert.equal(arrived.story_public, null);
    assert.equal(arrived.origin.kind, "arrived");
    assert.equal(arrived.last_meal?.phrase, "birds");
    assert.equal(arrived.milestones.count, 3);
    const told = decodeArkLife({id: "a2", origin: {kind: "born", parents: ["p1", "p2"], parents_brought_by: ["Voyager 2", "Voyager 5"]}, generation: 1, story_public: {kind: "public_debate", problem: "Mornings", way: {animal: "Bee", power: "One Flower"}, debate_id: null}});
    assert.ok(told && told.origin.kind === "born");
    assert.deepEqual(told.origin.kind === "born" ? told.origin.parents_brought_by : [], ["Voyager 2", "Voyager 5"]);
    assert.equal(told.story_public?.problem, "Mornings");
    // A private-looking shape never comes through as a story.
    assert.equal(decodeArkLife({id: "a3", story_public: {kind: "private_chat", problem: "secret"}})?.story_public, null);
    assert.equal(decodeArkLife(null), null);
    assert.equal(arkJoinLabels(["Voyager 2", "Voyager 5"], "en"), "Voyager 2 and Voyager 5");
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
    assert.equal(v1?.ark_day, undefined);
    const v2 = decodeArkSnapshot({voyage: {slug: "first"}, ark_day: 286.5, animals: [{id: "b", model_slug: "plains-zebra", name: "Plains Zebra", born_at: "2026-11-08T19:30:00Z", zone: "grassland", origin: "born", generation: 1, condition: "hungry", activity: "diurnal", sociality: "group", parents: ["p1", "p2"], bringers: [{label: "Voyager 2"}, {label: "Voyager 5"}]}]});
    const born = v2?.animals[0];
    assert.equal(v2?.ark_day, 286.5);
    assert.equal(born?.origin, "born");
    assert.equal(born?.arrived_at, "2026-11-08T19:30:00Z");
    assert.deepEqual(born?.parents, ["p1", "p2"]);
    assert.equal(born?.sociality, "group");
    assert.equal(born?.bringers?.length, 2);
});

test("placement: a group gathers, the young stand by a parent, the same for every viewer", () => {
    const herd = Array.from({length: 6}, (_, i) => animal(`z${i}`, "plains-zebra", "grassland", `2026-11-0${i + 1}T00:00:00Z`, {sociality: "group"}));
    const loners = Array.from({length: 6}, (_, i) => animal(`c${i}`, "cheetah", "grassland", `2026-11-0${i + 1}T01:00:00Z`, {sociality: "solitary"}));
    const foal = animal("foal", "plains-zebra", "grassland", "2026-11-09T00:00:00Z", {sociality: "group", origin: "born", parents: ["z2", "z3"]});
    const all = [...herd, ...loners, foal];
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
    const parent = placed.get("z2")!;
    const young = placed.get("foal")!;
    assert.ok(Math.hypot(parent.x - young.x, parent.z - young.z) < 4, "the foal is beside a parent");
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
